import type { ProjectBlueprint, ValidationIssue } from "@/lib/zod/blueprint-schemas";
import type { DocumentSnapshot } from "@/lib/blueprint-engine/validate/readiness";
import {
  extractClaimsFromDocument,
  normalizeUploadTypes,
  type DocumentClaims,
} from "@/lib/blueprint-engine/validate/extract-claims";

function consistencyError(
  id: string,
  message: string,
  resolution: string,
  documentTypes: string[]
): ValidationIssue {
  return {
    id,
    severity: "error",
    category: "consistency",
    message: message.startsWith("CONSISTENCY ERROR:")
      ? message
      : `CONSISTENCY ERROR: ${message}`,
    resolution,
    documentTypes,
  };
}

function canonicalStates(blueprint: ProjectBlueprint): Set<string> {
  return new Set(blueprint.stateMachines.flatMap((sm) => sm.states));
}

function canonicalApiKeys(blueprint: ProjectBlueprint): Set<string> {
  return new Set(blueprint.apis.map((api) => `${api.method}:${api.path}`));
}

function compareClaimsToModel(
  blueprint: ProjectBlueprint,
  claims: DocumentClaims
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const canonicalStatesSet = canonicalStates(blueprint);
  const canonicalApis = canonicalApiKeys(blueprint);

  for (const state of claims.states) {
    if (canonicalStatesSet.size > 0 && !canonicalStatesSet.has(state)) {
      issues.push(
        consistencyError(
          `CONSISTENCY-MODEL-STATE-${claims.documentType}-${state}`,
          `State "${state}" in ${claims.documentType} is not defined in canonical stateMachines`,
          `Use states from the canonical model: ${[...canonicalStatesSet].join(", ")}`,
          [claims.documentType]
        )
      );
    }
  }

  for (const endpoint of claims.endpoints) {
    const key = `${endpoint.method}:${endpoint.path}`;
    if (canonicalApis.size > 0 && !canonicalApis.has(key)) {
      issues.push(
        consistencyError(
          `CONSISTENCY-MODEL-API-${claims.documentType}-${endpoint.method}-${endpoint.path}`,
          `Endpoint ${endpoint.method} ${endpoint.path} in ${claims.documentType} is not in the canonical API catalogue`,
          "Reference only API paths listed in the canonical model or update the blueprint API catalogue",
          [claims.documentType]
        )
      );
    }
  }

  const canonicalEntities = new Set(Object.keys(blueprint.entities));
  for (const entity of claims.entities) {
    if (canonicalEntities.size > 0 && !canonicalEntities.has(entity)) {
      issues.push(
        consistencyError(
          `CONSISTENCY-MODEL-ENTITY-${claims.documentType}-${entity}`,
          `Entity "${entity}" in ${claims.documentType} is not in the canonical entity registry`,
          `Use canonical entities: ${[...canonicalEntities].join(", ")}`,
          [claims.documentType]
        )
      );
    }
  }

  return issues;
}

function compareUploadTypes(
  left: DocumentClaims,
  right: DocumentClaims
): ValidationIssue[] {
  if (left.uploadTypes.length === 0 || right.uploadTypes.length === 0) return [];

  const leftSet = new Set(left.uploadTypes);
  const rightSet = new Set(right.uploadTypes);
  const onlyLeft = left.uploadTypes.filter((type) => !rightSet.has(type));
  const onlyRight = right.uploadTypes.filter((type) => !leftSet.has(type));

  if (onlyLeft.length === 0 && onlyRight.length === 0) return [];

  return [
    consistencyError(
      `CONSISTENCY-UPLOAD-${left.documentType}-${right.documentType}`,
      `Upload types differ between ${left.documentType} (${left.uploadTypes.join(", ")}) and ${right.documentType} (${right.uploadTypes.join(", ")})`,
      "Align allowed upload MIME types and extensions across App Flow and Security Blueprint",
      [left.documentType, right.documentType]
    ),
  ];
}

function compareEndpoints(
  left: DocumentClaims,
  right: DocumentClaims
): ValidationIssue[] {
  if (left.endpoints.length === 0 || right.endpoints.length === 0) return [];

  const leftKeys = new Set(left.endpoints.map((e) => `${e.method}:${e.path}`));
  const rightKeys = new Set(right.endpoints.map((e) => `${e.method}:${e.path}`));
  const onlyLeft = [...leftKeys].filter((key) => !rightKeys.has(key));
  const onlyRight = [...rightKeys].filter((key) => !leftKeys.has(key));

  if (onlyLeft.length === 0 && onlyRight.length === 0) return [];

  return [
    consistencyError(
      `CONSISTENCY-API-${left.documentType}-${right.documentType}`,
      `API endpoints differ between ${left.documentType} and ${right.documentType}`,
      `Reconcile endpoints — only in ${left.documentType}: ${onlyLeft.join(", ") || "none"}; only in ${right.documentType}: ${onlyRight.join(", ") || "none"}`,
      [left.documentType, right.documentType]
    ),
  ];
}

function compareEntities(
  left: DocumentClaims,
  right: DocumentClaims
): ValidationIssue[] {
  if (left.entities.length === 0 || right.entities.length === 0) return [];

  const leftSet = new Set(left.entities);
  const rightSet = new Set(right.entities);
  const onlyLeft = left.entities.filter((entity) => !rightSet.has(entity));
  const onlyRight = right.entities.filter((entity) => !leftSet.has(entity));

  if (onlyLeft.length === 0 && onlyRight.length === 0) return [];

  return [
    consistencyError(
      `CONSISTENCY-ENTITY-${left.documentType}-${right.documentType}`,
      `Entity references differ between ${left.documentType} and ${right.documentType}`,
      `Reconcile tables — only in ${left.documentType}: ${onlyLeft.join(", ") || "none"}; only in ${right.documentType}: ${onlyRight.join(", ") || "none"}`,
      [left.documentType, right.documentType]
    ),
  ];
}

const PAIRWISE_CHECKS: Array<{
  pair: [string, string];
  check: (left: DocumentClaims, right: DocumentClaims) => ValidationIssue[];
}> = [
  { pair: ["app_flow", "security_blueprint"], check: compareUploadTypes },
  { pair: ["backend_schema", "trd"], check: compareEndpoints },
  { pair: ["backend_schema", "trd"], check: compareEntities },
  { pair: ["app_flow", "backend_schema"], check: compareEntities },
];

export function validateCrossDocumentConsistency(
  blueprint: ProjectBlueprint,
  documents: DocumentSnapshot[]
): ValidationIssue[] {
  const knownEntities = Object.keys(blueprint.entities);
  const knownRoles = Object.keys(blueprint.roles);

  const claimsByType = new Map<string, DocumentClaims>();
  for (const doc of documents) {
    if (!doc.content?.trim()) continue;
    claimsByType.set(
      doc.type,
      extractClaimsFromDocument(doc.type, doc.content, { knownEntities, knownRoles })
    );
  }

  const issues: ValidationIssue[] = [];

  for (const claims of claimsByType.values()) {
    issues.push(...compareClaimsToModel(blueprint, claims));
  }

  for (const { pair, check } of PAIRWISE_CHECKS) {
    const left = claimsByType.get(pair[0]);
    const right = claimsByType.get(pair[1]);
    if (!left || !right) continue;
    issues.push(...check(left, right));
  }

  return issues;
}

export function validateDocumentConsistency(
  blueprint: ProjectBlueprint,
  documents: DocumentSnapshot[]
): ValidationIssue[] {
  return validateCrossDocumentConsistency(blueprint, documents);
}

export function hasBlockingConsistencyErrors(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error" && issue.category === "consistency");
}

export function consistencyErrorsForDocument(
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

export { extractClaimsFromDocument, normalizeUploadTypes };
