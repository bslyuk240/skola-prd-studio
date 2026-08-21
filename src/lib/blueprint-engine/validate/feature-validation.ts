import type { FeatureBlueprint, ProjectBlueprint, ValidationIssue } from "@/lib/zod/blueprint-schemas";
import type { DocumentSnapshot } from "@/lib/blueprint-engine/validate/readiness";
import { lintTerminology } from "@/lib/blueprint-engine/validate/terminology-lint";
import {
  extractClaimsFromDocument,
  type DocumentClaims,
} from "@/lib/blueprint-engine/validate/extract-claims";
import { canonicalTableNames } from "@/lib/blueprint-engine/extract/build-feature-blueprint";

function consistencyError(
  id: string,
  message: string,
  resolution: string,
  documentTypes: string[],
  severity: ValidationIssue["severity"] = "error"
): ValidationIssue {
  return {
    id,
    severity,
    category: "consistency",
    message: message.startsWith("CONSISTENCY ERROR:") ? message : `CONSISTENCY ERROR: ${message}`,
    resolution,
    documentTypes,
  };
}

function compareEntities(left: DocumentClaims, right: DocumentClaims): ValidationIssue[] {
  if (left.entities.length === 0 || right.entities.length === 0) return [];

  const leftSet = new Set(left.entities);
  const rightSet = new Set(right.entities);
  const onlyLeft = left.entities.filter((entity) => !rightSet.has(entity));
  const onlyRight = right.entities.filter((entity) => !leftSet.has(entity));

  if (onlyLeft.length === 0 && onlyRight.length === 0) return [];

  return [
    consistencyError(
      `FEATURE-CONSISTENCY-ENTITY-${left.documentType}-${right.documentType}`,
      `Entity references differ between ${left.documentType} and ${right.documentType}`,
      `Reconcile tables — only in ${left.documentType}: ${onlyLeft.join(", ") || "none"}; only in ${right.documentType}: ${onlyRight.join(", ") || "none"}`,
      [left.documentType, right.documentType]
    ),
  ];
}

function compareEndpoints(left: DocumentClaims, right: DocumentClaims): ValidationIssue[] {
  if (left.endpoints.length === 0 || right.endpoints.length === 0) return [];

  const leftKeys = new Set(left.endpoints.map((e) => `${e.method}:${e.path}`));
  const rightKeys = new Set(right.endpoints.map((e) => `${e.method}:${e.path}`));
  const onlyLeft = [...leftKeys].filter((key) => !rightKeys.has(key));
  const onlyRight = [...rightKeys].filter((key) => !leftKeys.has(key));

  if (onlyLeft.length === 0 && onlyRight.length === 0) return [];

  return [
    consistencyError(
      `FEATURE-CONSISTENCY-API-${left.documentType}-${right.documentType}`,
      `API endpoints differ between ${left.documentType} and ${right.documentType}`,
      `Reconcile endpoints — only in ${left.documentType}: ${onlyLeft.join(", ") || "none"}; only in ${right.documentType}: ${onlyRight.join(", ") || "none"}`,
      [left.documentType, right.documentType]
    ),
  ];
}

const FEATURE_PAIRWISE_CHECKS: Array<{
  pair: [string, string];
  check: (left: DocumentClaims, right: DocumentClaims) => ValidationIssue[];
}> = [
  { pair: ["schema_changes", "api_changes"], check: compareEntities },
  { pair: ["schema_changes", "api_changes"], check: compareEndpoints },
  { pair: ["impact_analysis", "schema_changes"], check: compareEntities },
  { pair: ["feature_prd", "test_plan"], check: compareEntities },
];

const TABLE_REFERENCE_PATTERN =
  /\b(?:CREATE|ALTER|DROP|TABLE|FROM|JOIN|INTO|UPDATE|REFERENCES)\s+(?:TABLE\s+)?[`"']?([a-z][a-z0-9_]{1,62})[`"']?/gi;

function validateCanonicalTableUsage(
  featureBlueprint: FeatureBlueprint,
  linkedProjectBlueprint: ProjectBlueprint,
  documents: DocumentSnapshot[]
): ValidationIssue[] {
  const schemaDoc = documents.find((doc) => doc.type === "schema_changes" && doc.content?.trim());
  if (!schemaDoc?.content) return [];

  const allowedTables = new Set(canonicalTableNames(featureBlueprint, linkedProjectBlueprint));
  const newTables = new Set(
    Object.values(featureBlueprint.impactedEntities).map((entity) => entity.tableName.toLowerCase())
  );
  const canonicalOnly = new Set(
    Object.values(linkedProjectBlueprint.entities).map((entity) => entity.tableName.toLowerCase())
  );

  const issues: ValidationIssue[] = [];
  const referenced = new Set<string>();
  let match: RegExpExecArray | null;
  TABLE_REFERENCE_PATTERN.lastIndex = 0;
  while ((match = TABLE_REFERENCE_PATTERN.exec(schemaDoc.content)) !== null) {
    referenced.add(match[1]!.toLowerCase());
  }

  for (const table of referenced) {
    if (newTables.has(table)) continue;
    if (!canonicalOnly.has(table)) continue;
    if (allowedTables.has(table)) continue;

    issues.push(
      consistencyError(
        `FEATURE-TABLE-${table}`,
        `schema_changes references canonical table "${table}" with unexpected casing or alias`,
        `Use exact canonical table name from the linked project blueprint`,
        ["schema_changes"],
        "warning"
      )
    );
  }

  for (const [entityId, entity] of Object.entries(linkedProjectBlueprint.entities)) {
    const table = entity.tableName.toLowerCase();
    if (referenced.has(table)) continue;

    const mentionsEntityId = new RegExp(`\\b${entityId}\\b`, "i").test(schemaDoc.content);
    const mentionsWrongAlias =
      /\buser_accounts\b/i.test(schemaDoc.content) &&
      table === "users" &&
      entityId === "users";

    if (mentionsWrongAlias) {
      issues.push(
        consistencyError(
          `FEATURE-TABLE-ALIAS-${entityId}`,
          `schema_changes uses "user_accounts" but linked blueprint defines table "${entity.tableName}" for entity "${entityId}"`,
          `Replace aliases with canonical table name "${entity.tableName}"`,
          ["schema_changes"]
        )
      );
    } else if (mentionsEntityId && !referenced.has(table)) {
      issues.push(
        consistencyError(
          `FEATURE-TABLE-MISSING-${entityId}`,
          `schema_changes mentions entity "${entityId}" but not canonical table "${entity.tableName}"`,
          `Reference table "${entity.tableName}" when describing schema changes`,
          ["schema_changes"],
          "warning"
        )
      );
    }
  }

  return issues;
}

export function validateFeatureDocuments(
  featureBlueprint: FeatureBlueprint,
  linkedProjectBlueprint: ProjectBlueprint | null,
  documents: DocumentSnapshot[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const knownEntities = [
    ...Object.keys(featureBlueprint.linkedEntities),
    ...Object.keys(featureBlueprint.impactedEntities),
    ...Object.keys(linkedProjectBlueprint?.entities ?? {}),
  ];
  const knownRoles = Object.keys(linkedProjectBlueprint?.roles ?? {});

  if (linkedProjectBlueprint) {
    for (const doc of documents) {
      if (!doc.content?.trim()) continue;
      issues.push(...lintTerminology(linkedProjectBlueprint, doc.content, doc.type).issues);
    }
  }

  const claimsByType = new Map<string, DocumentClaims>();
  for (const doc of documents) {
    if (!doc.content?.trim()) continue;
    claimsByType.set(
      doc.type,
      extractClaimsFromDocument(doc.type, doc.content, { knownEntities, knownRoles })
    );
  }

  for (const { pair, check } of FEATURE_PAIRWISE_CHECKS) {
    const left = claimsByType.get(pair[0]);
    const right = claimsByType.get(pair[1]);
    if (!left || !right) continue;
    issues.push(...check(left, right));
  }

  if (linkedProjectBlueprint) {
    issues.push(
      ...validateCanonicalTableUsage(featureBlueprint, linkedProjectBlueprint, documents)
    );
  }

  return issues;
}

export function featureConsistencyErrorsForDocument(
  issues: ValidationIssue[],
  documentType: string
): ValidationIssue[] {
  return issues.filter(
    (issue) =>
      issue.category === "consistency" &&
      issue.severity === "error" &&
      issue.documentTypes.includes(documentType)
  );
}
