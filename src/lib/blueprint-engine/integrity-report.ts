import type { ProjectBlueprint, ValidationIssue } from "@/lib/zod/blueprint-schemas";
import {
  runBlueprintValidation,
  type ReadinessBreakdown,
  type DocumentSnapshot,
  type ReadinessScoreOptions,
} from "@/lib/blueprint-engine/validate/readiness";
import { isResolvableIssue } from "@/lib/blueprint-engine/critic/conflict-resolver";

export type IntegrityStatus = "pass" | "warning" | "fail";

export type IntegrityReport = {
  breakdown: ReadinessBreakdown;
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  hasBlockingErrors: boolean;
  canExport: boolean;
  status: IntegrityStatus;
};

export const INTEGRITY_CATEGORIES = [
  { key: "schema", label: "Database", breakdownKey: "schema" as const },
  { key: "flow", label: "Flow", breakdownKey: "flow" as const },
  { key: "conflicts", label: "Conflicts", breakdownKey: "conflicts" as const },
  { key: "assumptions", label: "Assumptions", breakdownKey: "assumptions" as const },
  { key: "security", label: "Security", breakdownKey: "security" as const },
  { key: "integrations", label: "Integrations", breakdownKey: "integrations" as const },
];

const EMPTY_BREAKDOWN: ReadinessBreakdown = {
  schema: null,
  flow: null,
  conflicts: null,
  assumptions: null,
  security: null,
  securitySpecCoverage: null,
  securityPosture: null,
  integrations: null,
  rbac: null,
  documentCoverage: null,
  architecture: null,
  overall: null,
  errorCount: 0,
  warningCount: 0,
  blockers: [],
  categoryStates: {
    schema: "pending",
    flow: "pending",
    conflicts: "pending",
    assumptions: "pending",
    security: "pending",
    integrations: "pending",
  },
  generationInProgress: false,
};

export function resolveIntegrityStatus(errorCount: number, warningCount: number): IntegrityStatus {
  if (errorCount > 0) return "fail";
  if (warningCount > 0) return "warning";
  return "pass";
}

export function buildIntegrityReport(
  blueprint: ProjectBlueprint | null,
  documents: DocumentSnapshot[] = [],
  options: ReadinessScoreOptions & { allowExportWithErrors?: boolean } = {}
): IntegrityReport {
  if (!blueprint) {
    return {
      breakdown: EMPTY_BREAKDOWN,
      issues: [],
      errorCount: 0,
      warningCount: 0,
      hasBlockingErrors: false,
      canExport: true,
      status: "pass",
    };
  }

  const { issues, breakdown } = runBlueprintValidation(blueprint, documents, {
    openSecurityTodos: options.openSecurityTodos,
    totalSecurityTodos: options.totalSecurityTodos,
  });
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const hasBlockingErrors = errorCount > 0;

  return {
    breakdown,
    issues,
    errorCount,
    warningCount,
    hasBlockingErrors,
    canExport: options.allowExportWithErrors ? true : !hasBlockingErrors,
    status: resolveIntegrityStatus(errorCount, warningCount),
  };
}

export function issueAcceptable(issue: ValidationIssue): boolean {
  return issue.severity === "error" && isResolvableIssue(issue);
}

export function groupIssuesByCategory(issues: ValidationIssue[]): Record<string, ValidationIssue[]> {
  const groups: Record<string, ValidationIssue[]> = {};

  for (const issue of issues) {
    const key = issue.category || "other";
    if (!groups[key]) groups[key] = [];
    groups[key].push(issue);
  }

  return groups;
}

export function formatIssueCategory(category: string): string {
  return category
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
