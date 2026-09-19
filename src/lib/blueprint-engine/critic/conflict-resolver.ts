import type { ProjectBlueprint, ValidationIssue, ResolutionOption } from "@/lib/zod/blueprint-schemas";
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

function parseStructMissingIssueId(id: string): { entity: string } | null {
  const match = id.match(/^STRUCT-missing-(.+)$/);
  if (!match) return null;
  return { entity: match[1] };
}

function parseEntityUnknownIssueId(id: string): { entity: string } | null {
  const match = id.match(/^ENTITY-UNKNOWN-(.+)$/);
  if (!match) return null;
  return { entity: match[1] };
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
  documents: DocumentSnapshot[] = [],
  // Reserved for issues with more than one resolution option (see
  // computeResolutionOptions). Every option today is the sole option for its
  // issue, so this isn't branched on yet — kept so the API/route layer has a
  // stable place to pass a user's choice once a validator offers a real one.
  selections: Record<string, string> = {}
): ConflictResolutionResult {
  void selections;
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
    const structMissing = parseStructMissingIssueId(issue.id);
    if (!structMissing || nextBlueprint.entities[structMissing.entity]) continue;

    nextBlueprint = {
      ...nextBlueprint,
      entities: {
        ...nextBlueprint.entities,
        [structMissing.entity]: {
          id: structMissing.entity,
          tableName: structMissing.entity,
          description: "Required table for AI-agent products — registered by architect critic",
          fields: [],
          complete: false,
        },
      },
    };
    patches.push({
      kind: "entity_registry",
      entity: structMissing.entity,
      sourceDocument: "blueprint_model",
    });
    resolvedIssueIds.push(issue.id);
  }

  // Single-document "unknown table" references (structural-completeness.ts) —
  // a separate check from CONSISTENCY-MODEL-ENTITY- above (cross-document
  // drift), but the same fix: register the table so the reference becomes
  // canonical instead of orphaned.
  for (const issue of errorIssues) {
    const entityUnknown = parseEntityUnknownIssueId(issue.id);
    if (!entityUnknown || nextBlueprint.entities[entityUnknown.entity]) continue;

    const sourceDocument = issue.documentTypes[0] ?? "unknown";
    nextBlueprint = {
      ...nextBlueprint,
      entities: {
        ...nextBlueprint.entities,
        [entityUnknown.entity]: {
          id: entityUnknown.entity,
          tableName: entityUnknown.entity,
          description: `Entity referenced in ${sourceDocument} — registered by architect critic`,
          fields: [],
          complete: false,
        },
      },
    };
    patches.push({
      kind: "entity_registry",
      entity: entityUnknown.entity,
      sourceDocument,
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

// Deliberately an allowlist, not a category-based guess: every prefix here
// must have a matching branch in patchBlueprintFromIssues. A broader
// `RESOLVABLE_CATEGORIES.has(issue.category)` fallback used to live here and
// falsely marked CONSISTENCY-SEM-*/CONSISTENCY-ENTITY-* (cross-document
// drift — e.g. two docs disagreeing on which tables exist) as resolvable
// even though no patch exists for them, so "fix" silently no-opped on those
// specific issues forever. They need real content written into a document,
// not a model patch, so they should fall through to the regenerate-document
// path instead (see the !issueAcceptable branch in
// blueprint-integrity-report.tsx).
export function isResolvableIssue(issue: ValidationIssue): boolean {
  if (issue.severity !== "error") return false;
  if (issue.category === "terminology") return true;
  if (issue.id.startsWith("CONSISTENCY-MODEL-ENTITY-")) return true;
  if (issue.id.startsWith("CONSISTENCY-MODEL-API-")) return true;
  if (issue.id.startsWith("CONSISTENCY-UPLOAD-")) return true;
  if (issue.id.startsWith("STRUCT-missing-")) return true;
  if (issue.id.startsWith("ENTITY-UNKNOWN-")) return true;
  return false;
}

/**
 * Candidate fixes for an issue. Every resolvable issue today has exactly one
 * correct patch (these validators only check "is X registered in the
 * canonical model"), so this always returns 0 or 1 options. The shape is
 * plural so a future validator with a genuine either/or fix — and the UI/API
 * layers that consume it — don't need another migration to support it.
 */
export function computeResolutionOptions(issue: ValidationIssue): ResolutionOption[] {
  if (!isResolvableIssue(issue)) return [];
  return [
    {
      id: "default",
      label: issue.resolution ?? "Apply fix",
    },
  ];
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
