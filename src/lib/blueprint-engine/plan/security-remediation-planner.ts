import type { SecurityFinding } from "@/lib/security-scanner";
import type { SecurityRemediationRequirement, SecurityScanModel } from "@/lib/zod/blueprint-schemas";

export type FindingWithRemediationId = SecurityFinding & {
  remediationRequirementId: string;
};

export function assignRemediationRequirementIds(
  findings: SecurityFinding[]
): FindingWithRemediationId[] {
  return findings.map((finding, index) => ({
    ...finding,
    remediationRequirementId: `REM-${String(index + 1).padStart(3, "0")}`,
  }));
}

export function remediationRequirementsFromFindings(
  findings: FindingWithRemediationId[]
): SecurityRemediationRequirement[] {
  return findings.map((finding) => ({
    id: finding.remediationRequirementId,
    findingTitle: finding.title,
    pack: finding.pack,
    confidence: finding.confidence,
    severity: finding.severity,
    statement: `Remediate: ${finding.title}`,
    recommendation: finding.recommendation,
  }));
}

export function buildSecurityScanModel(
  findings: FindingWithRemediationId[],
  safeToShipScore: number,
  linkedProjectId: string | null = null
): SecurityScanModel {
  const remediationRequirements = remediationRequirementsFromFindings(findings);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    linkedProjectId,
    safeToShipScore,
    scoreTarget: {
      id: "TARGET-SAFE-TO-SHIP",
      statement: `Safe to Ship Score target: ${safeToShipScore}/100 after all confirmed issues are remediated and re-verified`,
      kind: "target",
      requiresValidation: true,
      value: safeToShipScore,
    },
    remediationRequirements,
  };
}
