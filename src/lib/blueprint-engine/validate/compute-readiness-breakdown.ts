import type { ProjectBlueprint, ValidationIssue } from "@/lib/zod/blueprint-schemas";
import { requiresVerification } from "@/lib/blueprint-engine/registry/capabilities";
import type { DocumentSnapshot } from "@/lib/blueprint-engine/validate/readiness";
import { PROJECT_DOCUMENT_COUNT } from "@/lib/project-document-types";
import {
  type CategoryValidationState,
  type DocumentWithStatus,
  buildCategoryValidationStates,
  canValidateCategory,
  isGenerationInProgress,
  issueBelongsToCategory,
  type ValidationGateKey,
} from "@/lib/blueprint-engine/validate/validation-lifecycle";

export type ReadinessBreakdown = {
  schema: number | null;
  flow: number | null;
  conflicts: number | null;
  assumptions: number | null;
  security: number | null;
  integrations: number | null;
  rbac: number | null;
  documentCoverage: number | null;
  /** @deprecated Use `conflicts` — kept for backward-compatible exports */
  architecture: number | null;
  overall: number | null;
  errorCount: number;
  warningCount: number;
  blockers: string[];
  categoryStates: Record<ValidationGateKey, CategoryValidationState>;
  generationInProgress: boolean;
};

export type ReadinessScoreOptions = {
  openSecurityTodos?: number;
  totalSecurityTodos?: number;
};

const WEIGHTS = {
  schema: 0.2,
  flow: 0.15,
  conflicts: 0.2,
  assumptions: 0.1,
  security: 0.2,
  integrations: 0.15,
} as const;

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function countCategoryIssues(
  issues: ValidationIssue[],
  gate: ValidationGateKey,
  severity?: ValidationIssue["severity"]
): number {
  return issues.filter(
    (issue) =>
      issueBelongsToCategory(issue.category, gate) &&
      (severity ? issue.severity === severity : true)
  ).length;
}

function scoreOrNull(
  gate: ValidationGateKey,
  documents: DocumentWithStatus[],
  score: number
): number | null {
  return canValidateCategory(gate, documents) ? clampScore(score) : null;
}

function hasCriticalUnverifiedIntegrations(blueprint: ProjectBlueprint): boolean {
  return blueprint.integrations.some(
    (integration) => !integration.verified && requiresVerification(integration.name)
  );
}

function hasIncompleteEntities(blueprint: ProjectBlueprint): boolean {
  return Object.values(blueprint.entities).some(
    (entity) => !entity.complete && entity.fields.length === 0
  );
}

function scoreSchema(blueprint: ProjectBlueprint, issues: ValidationIssue[]): number {
  const entities = Object.values(blueprint.entities);
  if (entities.length === 0) return 40;

  const structuralErrors = issues.filter(
    (issue) =>
      issueBelongsToCategory(issue.category, "schema") && issue.severity === "error"
  ).length;
  const structuralWarnings = issues.filter(
    (issue) =>
      issue.category === "structural_completeness" && issue.severity === "warning"
  ).length;
  const allComplete = entities.every((entity) => entity.complete && entity.fields.length > 0);

  if (allComplete && structuralErrors === 0 && structuralWarnings === 0) {
    return 100;
  }

  const completeRatio = entities.filter((entity) => entity.complete).length / entities.length;
  let score = completeRatio * 100;
  score -= structuralErrors * 12;
  score -= structuralWarnings * 6;
  return clampScore(score);
}

function scoreFlow(blueprint: ProjectBlueprint, documents: DocumentSnapshot[], issues: ValidationIssue[]): number {
  const flowErrors = issues.filter(
    (issue) => issueBelongsToCategory(issue.category, "flow") && issue.severity === "error"
  ).length;
  const flowWarnings = issues.filter(
    (issue) => issueBelongsToCategory(issue.category, "flow") && issue.severity === "warning"
  ).length;
  const hasFlowDoc = documents.some((doc) => doc.type === "app_flow" && doc.content?.trim());

  if (flowErrors === 0 && flowWarnings === 0 && hasFlowDoc) {
    return 100;
  }

  let score = hasFlowDoc ? 92 : blueprint.stateMachines.length > 0 ? 75 : 55;
  score -= flowErrors * 15;
  score -= flowWarnings * 8;
  if (blueprint.classification.hasAiAgents && blueprint.stateMachines.length === 0) {
    score -= 20;
  }
  return clampScore(score);
}

function scoreConflicts(issues: ValidationIssue[]): number {
  const errorCount = issues.filter(
    (issue) => issueBelongsToCategory(issue.category, "conflicts") && issue.severity === "error"
  ).length;
  const warningCount = issues.filter(
    (issue) => issueBelongsToCategory(issue.category, "conflicts") && issue.severity === "warning"
  ).length;
  if (errorCount === 0 && warningCount === 0) return 100;

  let score = 100;
  score -= issues.filter(
    (issue) => issue.category === "consistency" && issue.severity === "error"
  ).length * 14;
  score -= issues.filter(
    (issue) => issue.category === "terminology" && issue.severity === "error"
  ).length * 10;
  score -= issues.filter(
    (issue) => issue.category === "entity_registry" && issue.severity === "error"
  ).length * 10;
  score -= issues.filter(
    (issue) => issue.category === "architecture" && issue.severity === "error"
  ).length * 12;
  score -= warningCount * 4;
  return clampScore(score);
}

function scoreAssumptions(blueprint: ProjectBlueprint, issues: ValidationIssue[]): number {
  const pendingValidation = blueprint.assumptions.filter(
    (assumption) => assumption.requiresValidation
  ).length;
  const assumptionIssues = issues.filter(
    (issue) => issueBelongsToCategory(issue.category, "assumptions") && issue.severity === "error"
  ).length;
  const assumptionWarnings = issues.filter(
    (issue) => issueBelongsToCategory(issue.category, "assumptions") && issue.severity === "warning"
  ).length;

  if (pendingValidation === 0 && assumptionIssues === 0 && assumptionWarnings === 0) {
    return 100;
  }

  let score = 100 - pendingValidation * 12;
  score -= assumptionIssues * 10;
  score -= assumptionWarnings * 5;
  return clampScore(score);
}

function scoreSecurity(
  blueprint: ProjectBlueprint,
  documents: DocumentSnapshot[],
  issues: ValidationIssue[],
  options: ReadinessScoreOptions
): number {
  const securityDoc = documents.find((doc) => doc.type === "security_blueprint");
  const securityErrors = issues.filter(
    (issue) => issueBelongsToCategory(issue.category, "security") && issue.severity === "error"
  ).length;
  const securityWarnings = issues.filter(
    (issue) => issueBelongsToCategory(issue.category, "security") && issue.severity === "warning"
  ).length;
  const openTodos = options.openSecurityTodos ?? 0;

  if (
    securityDoc?.content?.trim() &&
    openTodos === 0 &&
    securityErrors === 0 &&
    securityWarnings === 0
  ) {
    return 100;
  }

  let score = securityDoc?.content?.trim() ? 88 : 60;
  score -= securityErrors * 15;
  score -= securityWarnings * 6;

  const totalTodos = options.totalSecurityTodos ?? 0;
  if (totalTodos > 0) {
    const resolvedRatio = (totalTodos - openTodos) / totalTodos;
    score = Math.min(score, 40 + resolvedRatio * 60);
  }
  score -= openTodos * 8;

  if (blueprint.product.securityRequirement === "enterprise" && securityErrors > 0) {
    score -= 10;
  }

  return clampScore(score);
}

function scoreIntegrations(blueprint: ProjectBlueprint, issues: ValidationIssue[]): number {
  if (blueprint.integrations.length === 0) return 100;

  const verificationIssues = issues.filter(
    (issue) =>
      issueBelongsToCategory(issue.category, "integrations") && issue.severity === "error"
  ).length;
  const verificationWarnings = issues.filter(
    (issue) =>
      issueBelongsToCategory(issue.category, "integrations") && issue.severity === "warning"
  ).length;
  const allVerified = blueprint.integrations.every((integration) => integration.verified);

  if (allVerified && verificationIssues === 0 && verificationWarnings === 0) {
    return hasCriticalUnverifiedIntegrations(blueprint) ? 89 : 100;
  }

  const verified = blueprint.integrations.filter((integration) => integration.verified).length;
  let score = (verified / blueprint.integrations.length) * 100;
  score -= verificationWarnings * 8;
  score -= verificationIssues * 12;

  if (hasCriticalUnverifiedIntegrations(blueprint)) {
    score = Math.min(score, 89);
  }

  return clampScore(score);
}

function scoreRbac(blueprint: ProjectBlueprint, issues: ValidationIssue[]): number {
  const roleCount = Object.keys(blueprint.roles).length;
  const permissionCount = Object.keys(blueprint.permissions).length;
  let score = 70;
  if (roleCount > 0) score += 10;
  if (permissionCount > 0) score += 15;
  score -= issues.filter((issue) => issue.category === "rbac" && issue.severity === "error").length * 12;
  return clampScore(score);
}

function scoreDocumentCoverage(documents: DocumentSnapshot[]): number {
  const expected = PROJECT_DOCUMENT_COUNT;
  const readyCount = documents.filter((doc) => doc.content?.trim()).length;
  return clampScore((readyCount / expected) * 100);
}

function collectBlockers(
  blueprint: ProjectBlueprint,
  issues: ValidationIssue[],
  options: ReadinessScoreOptions,
  documents: DocumentWithStatus[]
): string[] {
  const blockers: string[] = [];

  if (issues.some((issue) => issue.severity === "error")) {
    blockers.push("validation_errors");
  }
  if (canValidateCategory("schema", documents) && hasIncompleteEntities(blueprint)) {
    blockers.push("incomplete_entities");
  }
  if (canValidateCategory("integrations", documents) && hasCriticalUnverifiedIntegrations(blueprint)) {
    blockers.push("unverified_critical_integrations");
  }
  if ((options.openSecurityTodos ?? 0) > 0) {
    blockers.push("open_security_todos");
  }
  if (blueprint.assumptions.some((assumption) => assumption.requiresValidation)) {
    blockers.push("assumptions_need_validation");
  }

  return blockers;
}

function computeWeightedOverall(
  scores: Record<ValidationGateKey, number | null>,
  states: Record<ValidationGateKey, CategoryValidationState>
): number | null {
  const weightedKeys: ValidationGateKey[] = [
    "schema",
    "flow",
    "conflicts",
    "assumptions",
    "security",
    "integrations",
  ];

  if (weightedKeys.some((key) => states[key] === "pending")) {
    return null;
  }

  const overall = Math.round(
    (scores.schema ?? 0) * WEIGHTS.schema +
      (scores.flow ?? 0) * WEIGHTS.flow +
      (scores.conflicts ?? 0) * WEIGHTS.conflicts +
      (scores.assumptions ?? 0) * WEIGHTS.assumptions +
      (scores.security ?? 0) * WEIGHTS.security +
      (scores.integrations ?? 0) * WEIGHTS.integrations
  );

  return clampScore(overall);
}

export function computeReadinessBreakdown(
  blueprint: ProjectBlueprint,
  documents: DocumentSnapshot[],
  issues: ValidationIssue[],
  options: ReadinessScoreOptions = {},
  documentsWithStatus: DocumentWithStatus[] = documents.map((doc) => ({
    type: doc.type,
    status: doc.status ?? (doc.content?.trim() ? "ready" : "pending"),
    content: doc.content,
  }))
): ReadinessBreakdown {
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const generationInProgress = isGenerationInProgress(documentsWithStatus);

  const categoryErrors: Partial<Record<ValidationGateKey, number>> = {
    schema: countCategoryIssues(issues, "schema", "error"),
    flow: countCategoryIssues(issues, "flow", "error"),
    conflicts: countCategoryIssues(issues, "conflicts", "error"),
    assumptions: countCategoryIssues(issues, "assumptions", "error"),
    security: countCategoryIssues(issues, "security", "error"),
    integrations: countCategoryIssues(issues, "integrations", "error"),
  };
  const categoryWarnings: Partial<Record<ValidationGateKey, number>> = {
    schema: countCategoryIssues(issues, "schema", "warning"),
    flow: countCategoryIssues(issues, "flow", "warning"),
    conflicts: countCategoryIssues(issues, "conflicts", "warning"),
    assumptions: countCategoryIssues(issues, "assumptions", "warning"),
    security: countCategoryIssues(issues, "security", "warning"),
    integrations: countCategoryIssues(issues, "integrations", "warning"),
  };

  const categoryStates = buildCategoryValidationStates(
    documentsWithStatus,
    categoryErrors,
    categoryWarnings
  );

  const schema = scoreOrNull("schema", documentsWithStatus, scoreSchema(blueprint, issues));
  const flow = scoreOrNull("flow", documentsWithStatus, scoreFlow(blueprint, documents, issues));
  const conflicts = scoreOrNull(
    "conflicts",
    documentsWithStatus,
    scoreConflicts(issues)
  );
  const assumptions = scoreOrNull(
    "assumptions",
    documentsWithStatus,
    scoreAssumptions(blueprint, issues)
  );
  const security = scoreOrNull(
    "security",
    documentsWithStatus,
    scoreSecurity(blueprint, documents, issues, options)
  );
  const integrations = scoreOrNull(
    "integrations",
    documentsWithStatus,
    scoreIntegrations(blueprint, issues)
  );
  const rbac = scoreRbac(blueprint, issues);
  const documentCoverage = generationInProgress
    ? null
    : scoreDocumentCoverage(documents);

  let overall = computeWeightedOverall(
    { schema, flow, conflicts, assumptions, security, integrations },
    categoryStates
  );

  const blockers = collectBlockers(blueprint, issues, options, documentsWithStatus);

  if (overall !== null && blockers.length > 0) {
    overall = Math.min(overall, 99);
  }
  if (overall !== null && warningCount > 4) {
    overall = Math.min(overall, 94);
  }

  return {
    schema,
    flow,
    conflicts,
    assumptions,
    security,
    integrations,
    rbac,
    documentCoverage,
    architecture: conflicts,
    overall,
    errorCount,
    warningCount,
    blockers,
    categoryStates,
    generationInProgress,
  };
}
