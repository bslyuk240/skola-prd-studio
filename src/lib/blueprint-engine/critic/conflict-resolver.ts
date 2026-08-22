import type { ProjectBlueprint, ValidationIssue } from "@/lib/zod/blueprint-schemas";
import {
  applyGlossaryToBlueprint,
  mergeGlossaryEntries,
} from "@/lib/blueprint-engine/registry/glossary-builder";
import { finalizeBlueprint } from "@/lib/blueprint-engine/plan/finalize-blueprint";
import type { DocumentSnapshot } from "@/lib/blueprint-engine/validate/readiness";
import { extractClaimsFromDocument, normalizeUploadTypes } from "@/lib/blueprint-engine/validate/extract-claims";

export type BlueprintPatch =
  | { kind: "glossary_synonym"; canonical: string; synonym: string }
  | { kind: "glossary_expanded" }
  | { kind: "entity_registry"; entity: string; sourceDocument: string }
  | { kind: "api_catalogue"; method: string; path: string; sourceDocument: string }
  | { kind: "upload_policy"; allowedTypes: string[] };

export type ConflictResolutionResult = {
  blueprint: ProjectBlueprint;
  patches: BlueprintPatch[];
  resolvedIssueIds: string[];
};

const RESOLVABLE_CATEGORIES = new Set([
  "terminology",
  "consistency",
  "entity",
  "architecture",
]);

function parseTerminologyIssue(message: string): { canonical: string; synonym: string } | null {
  const match = message.match(/Use "([^"]+)" instead of "([^"]+)"/);
  if (!match) return null;
  return { canonical: match[1], synonym: match[2] };
}

function parseEntityIssueId(id: string): { documentType: string; entity: string } | null {
  const match = id.match(/^CONSISTENCY-MODEL-ENTITY-([^-]+)-(.+)$/);
  if (!match) return null;
  return { documentType: match[1], entity: match[2] };
}

function parseApiIssueId(id: string): { documentType: string; method: string; path: string } | null {
  const match = id.match(/^CONSISTENCY-MODEL-API-([^-]+)-([A-Z]+)-(.+)$/);
  if (!match) return null;
  return { documentType: match[1], method: match[2], path: match[3] };
}

function nextApiId(blueprint: ProjectBlueprint): string {
  const numbers = blueprint.apis
    .map((api) => Number.parseInt(api.id.replace(/\D/g, ""), 10))
    .filter((value) => !Number.isNaN(value));
  const next = numbers.length === 0 ? 1 : Math.max(...numbers) + 1;
  return `API-${String(next).padStart(3, "0")}`;
}

/** Patch canonical model from validator issues — never free-form document rewrite (P8-2). */
export function patchBlueprintFromIssues(
  blueprint: ProjectBlueprint,
  issues: ValidationIssue[],
  documents: DocumentSnapshot[] = []
): ConflictResolutionResult {
  let nextBlueprint: ProjectBlueprint = { ...blueprint, glossary: [...blueprint.glossary] };
  const patches: BlueprintPatch[] = [];
  const resolvedIssueIds: string[] = [];

  const errorIssues = issues.filter((issue) => issue.severity === "error");

  for (const issue of errorIssues) {
    if (issue.category === "terminology") {
      const parsed = parseTerminologyIssue(issue.message);
      if (!parsed) continue;

      const entry = nextBlueprint.glossary.find((item) => item.canonical === parsed.canonical);
      if (entry && !entry.rejectedSynonyms.includes(parsed.synonym)) {
        nextBlueprint = {
          ...nextBlueprint,
          glossary: mergeGlossaryEntries(nextBlueprint.glossary, [
            {
              canonical: parsed.canonical,
              definition: entry.definition,
              rejectedSynonyms: [parsed.synonym],
            },
          ]),
        };
        patches.push({
          kind: "glossary_synonym",
          canonical: parsed.canonical,
          synonym: parsed.synonym,
        });
        resolvedIssueIds.push(issue.id);
      } else if (entry) {
        resolvedIssueIds.push(issue.id);
      }
    }
  }

  for (const issue of errorIssues) {
    const entity = parseEntityIssueId(issue.id);
    if (!entity || nextBlueprint.entities[entity.entity]) continue;

    nextBlueprint = {
      ...nextBlueprint,
      entities: {
        ...nextBlueprint.entities,
        [entity.entity]: {
          id: entity.entity,
          tableName: entity.entity,
          description: `Entity referenced in ${entity.documentType} — registered by architect critic`,
          fields: [],
          complete: false,
        },
      },
    };
    patches.push({
      kind: "entity_registry",
      entity: entity.entity,
      sourceDocument: entity.documentType,
    });
    resolvedIssueIds.push(issue.id);
  }

  for (const issue of errorIssues) {
    const api = parseApiIssueId(issue.id);
    if (!api) continue;
    const exists = nextBlueprint.apis.some(
      (endpoint) => endpoint.method === api.method && endpoint.path === api.path
    );
    if (exists) {
      resolvedIssueIds.push(issue.id);
      continue;
    }

    nextBlueprint = {
      ...nextBlueprint,
      apis: [
        ...nextBlueprint.apis,
        {
          id: nextApiId(nextBlueprint),
          method: api.method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
          path: api.path,
          purpose: `Endpoint referenced in ${api.documentType} — added by architect critic`,
          authRequired: true,
          idempotent: api.method === "GET",
          delivery: "sync" as const,
        },
      ],
    };
    patches.push({
      kind: "api_catalogue",
      method: api.method,
      path: api.path,
      sourceDocument: api.documentType,
    });
    resolvedIssueIds.push(issue.id);
  }

  if (issueMatchesUploadConflict(errorIssues)) {
    const mergedTypes = mergeUploadTypesFromDocuments(documents);
    if (mergedTypes.length > 0) {
      nextBlueprint = {
        ...nextBlueprint,
        uploadPolicy: { allowedTypes: mergedTypes },
      };
      patches.push({ kind: "upload_policy", allowedTypes: mergedTypes });
      for (const issue of errorIssues) {
        if (issue.id.startsWith("CONSISTENCY-UPLOAD-")) {
          resolvedIssueIds.push(issue.id);
        }
      }
    }
  }

  nextBlueprint = applyGlossaryToBlueprint(finalizeBlueprint(nextBlueprint));
  const glossaryExpanded = nextBlueprint.glossary.some((entry) => {
    const previous = blueprint.glossary.find((item) => item.canonical === entry.canonical);
    return (
      !previous ||
      entry.rejectedSynonyms.length > previous.rejectedSynonyms.length
    );
  });
  if (glossaryExpanded && !patches.some((patch) => patch.kind === "glossary_expanded")) {
    patches.push({ kind: "glossary_expanded" });
  }

  return {
    blueprint: nextBlueprint,
    patches,
    resolvedIssueIds: [...new Set(resolvedIssueIds)],
  };
}

function issueMatchesUploadConflict(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.id.startsWith("CONSISTENCY-UPLOAD-"));
}

function mergeUploadTypesFromDocuments(documents: DocumentSnapshot[]): string[] {
  const merged = documents.flatMap((doc) =>
    extractClaimsFromDocument(doc.type, doc.content).uploadTypes
  );
  return normalizeUploadTypes(merged);
}

export function isResolvableIssue(issue: ValidationIssue): boolean {
  if (issue.severity !== "error") return false;
  if (issue.category === "terminology") return true;
  if (issue.id.startsWith("CONSISTENCY-MODEL-ENTITY-")) return true;
  if (issue.id.startsWith("CONSISTENCY-MODEL-API-")) return true;
  if (issue.id.startsWith("CONSISTENCY-UPLOAD-")) return true;
  if (issue.id.startsWith("CONSISTENCY-SEM-")) return true;
  if (issue.id.startsWith("CONSISTENCY-ENTITY-")) return true;
  return RESOLVABLE_CATEGORIES.has(issue.category) && issue.documentTypes.length > 0;
}

export function affectedDocumentTypes(issues: ValidationIssue[]): string[] {
  const types = new Set<string>();
  for (const issue of issues) {
    if (issue.severity !== "error" || !isResolvableIssue(issue)) continue;

    if (issue.id.startsWith("CONSISTENCY-SEM-")) {
      types.add("backend_schema");
      continue;
    }

    if (issue.id.startsWith("CONSISTENCY-ENTITY-")) {
      if (issue.documentTypes.includes("backend_schema")) {
        types.add("backend_schema");
      }
      if (issue.documentTypes.includes("trd")) {
        types.add("trd");
      }
      continue;
    }

    issue.documentTypes.forEach((type) => types.add(type));
  }
  return [...types];
}
