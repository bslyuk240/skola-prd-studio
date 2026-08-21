import type { ProjectBlueprint, SecurityScanModel, ValidationIssue } from "@/lib/zod/blueprint-schemas";
import type { SecurityRemediationRequirement } from "@/lib/zod/blueprint-schemas";
import { extractClaimsFromDocument } from "@/lib/blueprint-engine/validate/extract-claims";
import { validateAiPolicyInDocument } from "@/lib/blueprint-engine/validate/ai-action-policy";

export type SecurityFixValidationReport = {
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  confirmedCoverage: {
    total: number;
    covered: number;
    missingRequirementIds: string[];
  };
  status: "pass" | "warning" | "fail";
};

function significantTitleTokens(title: string): string[] {
  return title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 4)
    .filter((token) => !["issue", "found", "missing", "detected", "security"].includes(token));
}

export function findingMentionedInPrd(
  requirement: SecurityRemediationRequirement,
  prdContent: string
): boolean {
  const normalized = prdContent.toLowerCase();
  if (normalized.includes(requirement.id.toLowerCase())) return true;
  if (normalized.includes(requirement.findingTitle.toLowerCase())) return true;

  const tokens = significantTitleTokens(requirement.findingTitle);
  if (tokens.length === 0) return false;

  const matched = tokens.filter((token) => normalized.includes(token));
  return matched.length >= Math.max(1, Math.ceil(tokens.length * 0.5));
}

export function validateConfirmedFindingCoverage(
  scanModel: SecurityScanModel,
  prdContent: string
): { issues: ValidationIssue[]; missingRequirementIds: string[] } {
  const issues: ValidationIssue[] = [];
  const missingRequirementIds: string[] = [];
  const confirmed = scanModel.remediationRequirements.filter(
    (req) => req.confidence === "confirmed"
  );

  for (const requirement of confirmed) {
    if (findingMentionedInPrd(requirement, prdContent)) continue;

    missingRequirementIds.push(requirement.id);
    issues.push({
      id: `SEC-PRD-MISSING-${requirement.id}`,
      severity: "warning",
      category: "security_fix_prd",
      message: `Security Fix PRD does not address confirmed finding ${requirement.id}: "${requirement.findingTitle}"`,
      resolution: `Add a remediation section referencing ${requirement.id} with fix steps and acceptance criteria`,
      documentTypes: ["security_fix_prd"],
    });
  }

  return { issues, missingRequirementIds };
}

export function validateSecurityFixAgainstBlueprint(
  linkedBlueprint: ProjectBlueprint,
  securityBlueprintContent: string | null | undefined,
  prdContent: string
): ValidationIssue[] {
  if (!securityBlueprintContent?.trim()) return [];

  const issues: ValidationIssue[] = [];
  const prdLower = prdContent.toLowerCase();
  const blueprintLower = securityBlueprintContent.toLowerCase();

  const uploadTypes = linkedBlueprint.uploadPolicy?.allowedTypes ?? [];
  for (const mimeType of uploadTypes) {
    const token = mimeType.split("/")[0]?.toLowerCase();
    if (!token) continue;
    if (blueprintLower.includes(token) && !prdLower.includes(token)) {
      issues.push({
        id: `SEC-BLUEPRINT-UPLOAD-${token}`,
        severity: "warning",
        category: "security_blueprint_alignment",
        message: `Security Fix PRD does not mention upload control "${mimeType}" defined in linked security blueprint`,
        resolution: "Reference upload validation and authorization for this MIME type in the fix PRD",
        documentTypes: ["security_fix_prd", "security_blueprint"],
      });
    }
  }

  if (linkedBlueprint.classification.hasAiAgents) {
    const aiPolicyIssues = validateAiPolicyInDocument(linkedBlueprint, prdContent, "security_fix_prd");
    issues.push(
      ...aiPolicyIssues.filter((issue) => issue.severity === "error").map((issue) => ({
        ...issue,
        severity: "warning" as const,
        category: "security_blueprint_alignment",
        message: `Security Fix PRD may conflict with linked AI action policy: ${issue.message}`,
      }))
    );
  }

  const blueprintClaims = extractClaimsFromDocument("security_blueprint", securityBlueprintContent, {
    knownEntities: Object.keys(linkedBlueprint.entities),
    knownRoles: Object.keys(linkedBlueprint.roles),
  });
  const prdClaims = extractClaimsFromDocument("security_fix_prd", prdContent, {
    knownEntities: Object.keys(linkedBlueprint.entities),
    knownRoles: Object.keys(linkedBlueprint.roles),
  });

  if (blueprintClaims.uploadTypes.length > 0 && prdClaims.uploadTypes.length > 0) {
    const blueprintSet = new Set(blueprintClaims.uploadTypes);
    const missing = blueprintClaims.uploadTypes.filter((type) => !prdClaims.uploadTypes.includes(type));
    if (missing.length > 0) {
      issues.push({
        id: "SEC-BLUEPRINT-UPLOAD-MISMATCH",
        severity: "warning",
        category: "security_blueprint_alignment",
        message: `Security Fix PRD upload types (${prdClaims.uploadTypes.join(", ")}) do not cover blueprint types (${blueprintClaims.uploadTypes.join(", ")})`,
        resolution: "Align upload remediation with the linked security blueprint allowed types",
        documentTypes: ["security_fix_prd", "security_blueprint"],
      });
    }

    const extra = prdClaims.uploadTypes.filter((type) => !blueprintSet.has(type));
    if (extra.length > 0 && missing.length === 0) {
      issues.push({
        id: "SEC-BLUEPRINT-UPLOAD-EXTRA",
        severity: "warning",
        category: "security_blueprint_alignment",
        message: `Security Fix PRD introduces upload types not present in linked security blueprint: ${extra.join(", ")}`,
        resolution: "Confirm new upload types are intentional or align with the canonical security blueprint",
        documentTypes: ["security_fix_prd", "security_blueprint"],
      });
    }
  }

  return issues;
}

export function buildSecurityFixValidationReport(
  scanModel: SecurityScanModel,
  prdContent: string,
  linkedBlueprint: ProjectBlueprint | null = null,
  securityBlueprintContent?: string | null
): SecurityFixValidationReport {
  const { issues: coverageIssues, missingRequirementIds } = validateConfirmedFindingCoverage(
    scanModel,
    prdContent
  );
  const blueprintIssues =
    linkedBlueprint && securityBlueprintContent
      ? validateSecurityFixAgainstBlueprint(linkedBlueprint, securityBlueprintContent, prdContent)
      : [];

  const issues = [...coverageIssues, ...blueprintIssues];
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const confirmedTotal = scanModel.remediationRequirements.filter(
    (req) => req.confidence === "confirmed"
  ).length;
  const covered = confirmedTotal - missingRequirementIds.length;

  let status: SecurityFixValidationReport["status"] = "pass";
  if (errorCount > 0) status = "fail";
  else if (warningCount > 0) status = "warning";

  return {
    issues,
    errorCount,
    warningCount,
    confirmedCoverage: {
      total: confirmedTotal,
      covered,
      missingRequirementIds,
    },
    status,
  };
}
