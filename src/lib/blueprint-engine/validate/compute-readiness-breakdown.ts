import type { ProjectBlueprint, ValidationIssue } from "@/lib/zod/blueprint-schemas";
import { requiresVerification } from "@/lib/blueprint-engine/registry/capabilities";
import type { DocumentSnapshot } from "@/lib/blueprint-engine/validate/readiness";
import { PROJECT_DOCUMENT_COUNT } from "@/lib/project-document-types";

export type ReadinessBreakdown = {
  schema: number;
  flow: number;
  conflicts: number;
  assumptions: number;
  security: number;
  integrations: number;
  rbac: number;
  documentCoverage: number;
  /** @deprecated Use `conflicts` — kept for backward-compatible exports */
  architecture: number;
  overall: number;
  errorCount: number;
  warningCount: number;
  blockers: string[];
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

function countIssues(
  issues: ValidationIssue[],
  categories: string[],
  severity?: ValidationIssue["severity"]
): number {
  return issues.filter(
    (issue) =>
      categories.includes(issue.category) &&
      (severity ? issue.severity === severity : true)
  ).length;
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

  const structuralErrors = countIssues(issues, ["structural_completeness", "entity_registry"], "error");
  const structuralWarnings = countIssues(issues, ["structural_completeness"], "warning");
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
  const flowErrors = countIssues(issues, ["state_machine"], "error");
  const flowWarnings = countIssues(issues, ["state_machine"], "warning");
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
  const errorCount = countIssues(
    issues,
    ["consistency", "terminology", "entity_registry", "architecture"],
    "error"
  );
  const warningCount = countIssues(issues, ["consistency", "terminology"], "warning");
  if (errorCount === 0 && warningCount === 0) return 100;

  let score = 100;
  score -= countIssues(issues, ["consistency"], "error") * 14;
  score -= countIssues(issues, ["terminology"], "error") * 10;
  score -= countIssues(issues, ["entity_registry"], "error") * 10;
  score -= countIssues(issues, ["architecture"], "error") * 12;
  score -= warningCount * 4;
  return clampScore(score);
}

function scoreAssumptions(blueprint: ProjectBlueprint, issues: ValidationIssue[]): number {
  const pendingValidation = blueprint.assumptions.filter(
    (assumption) => assumption.requiresValidation
  ).length;
  const assumptionIssues = countIssues(issues, ["assumption", "assumptions"], "error");
  const assumptionWarnings = countIssues(issues, ["assumption", "assumptions"], "warning");

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
  const securityErrors = countIssues(issues, ["security", "ai_action_policy"], "error");
  const securityWarnings = countIssues(issues, ["security", "ai_action_policy"], "warning");
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

  const verificationIssues = countIssues(issues, ["integration_verification"], "error");
  const verificationWarnings = countIssues(issues, ["integration_verification"], "warning");
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
  score -= countIssues(issues, ["rbac"], "error") * 12;
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
  options: ReadinessScoreOptions
): string[] {
  const blockers: string[] = [];

  if (issues.some((issue) => issue.severity === "error")) {
    blockers.push("validation_errors");
  }
  if (hasIncompleteEntities(blueprint)) {
    blockers.push("incomplete_entities");
  }
  if (hasCriticalUnverifiedIntegrations(blueprint)) {
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

export function computeReadinessBreakdown(
  blueprint: ProjectBlueprint,
  documents: DocumentSnapshot[],
  issues: ValidationIssue[],
  options: ReadinessScoreOptions = {}
): ReadinessBreakdown {
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;

  const schema = scoreSchema(blueprint, issues);
  const flow = scoreFlow(blueprint, documents, issues);
  const conflicts = scoreConflicts(issues);
  const assumptions = scoreAssumptions(blueprint, issues);
  const security = scoreSecurity(blueprint, documents, issues, options);
  const integrations = scoreIntegrations(blueprint, issues);
  const rbac = scoreRbac(blueprint, issues);
  const documentCoverage = scoreDocumentCoverage(documents);

  let overall = Math.round(
    schema * WEIGHTS.schema +
      flow * WEIGHTS.flow +
      conflicts * WEIGHTS.conflicts +
      assumptions * WEIGHTS.assumptions +
      security * WEIGHTS.security +
      integrations * WEIGHTS.integrations
  );

  const blockers = collectBlockers(blueprint, issues, options);

  if (blockers.length > 0) {
    overall = Math.min(overall, 99);
  }
  if (warningCount > 4) {
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
    overall: clampScore(overall),
    errorCount,
    warningCount,
    blockers,
  };
}
