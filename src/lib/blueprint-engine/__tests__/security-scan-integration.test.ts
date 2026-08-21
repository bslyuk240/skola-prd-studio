import { describe, expect, it } from "vitest";
import {
  assignRemediationRequirementIds,
  buildSecurityScanModel,
} from "@/lib/blueprint-engine/plan/security-remediation-planner";
import {
  buildSecurityFixValidationReport,
  findingMentionedInPrd,
  validateConfirmedFindingCoverage,
  validateSecurityFixAgainstBlueprint,
} from "@/lib/blueprint-engine/validate/security-fix-validation";
import { buildBlueprintSeedFromWizard } from "@/lib/blueprint-engine/extract/from-wizard-context";
import { applyGlossaryToBlueprint } from "@/lib/blueprint-engine/registry/glossary-builder";
import { finalizeBlueprint } from "@/lib/blueprint-engine/plan/finalize-blueprint";
import type { ProjectContext } from "@/lib/ai-prompts";
import type { SecurityFinding } from "@/lib/security-scanner";

const sampleFindings: SecurityFinding[] = [
  {
    pack: "Baseline Web Security",
    title: ".env file committed to repository",
    description: "Secrets may be exposed",
    confidence: "confirmed",
    severity: "critical",
    recommendation: "Remove .env from git and rotate secrets",
  },
  {
    pack: "API Security",
    title: "Missing rate limiting on auth routes",
    description: "Auth endpoints lack throttling",
    confidence: "likely_gap",
    severity: "high",
    recommendation: "Add rate limiting middleware",
  },
];

describe("security scan integration", () => {
  it("maps each finding to a remediation requirement ID", () => {
    const enriched = assignRemediationRequirementIds(sampleFindings);
    expect(enriched[0]?.remediationRequirementId).toBe("REM-001");
    expect(enriched[1]?.remediationRequirementId).toBe("REM-002");

    const model = buildSecurityScanModel(enriched, 62);
    expect(model.remediationRequirements).toHaveLength(2);
    expect(model.scoreTarget.kind).toBe("target");
    expect(model.scoreTarget.requiresValidation).toBe(true);
    expect(model.scoreTarget.value).toBe(62);
  });

  it("acceptance gate: missing confirmed finding in PRD triggers WARNING", () => {
    const enriched = assignRemediationRequirementIds(sampleFindings);
    const model = buildSecurityScanModel(enriched, 62);
    const incompletePrd = `
# Security Fix PRD
## 4. Confirmed Issues
### REM-002 Missing rate limiting
Fix auth route throttling.
    `;

    const { issues, missingRequirementIds } = validateConfirmedFindingCoverage(model, incompletePrd);
    expect(missingRequirementIds).toContain("REM-001");
    expect(issues.some((issue) => issue.severity === "warning")).toBe(true);
    expect(issues.some((issue) => issue.message.includes("REM-001"))).toBe(true);

    const report = buildSecurityFixValidationReport(model, incompletePrd);
    expect(report.status).toBe("warning");
    expect(report.confirmedCoverage.covered).toBe(0);
    expect(report.confirmedCoverage.total).toBe(1);
  });

  it("detects PRD coverage by remediation ID or finding title", () => {
    const requirement = {
      id: "REM-001",
      findingTitle: ".env file committed to repository",
      pack: "Baseline",
      confidence: "confirmed" as const,
      severity: "critical" as const,
      statement: "Remediate env leak",
      recommendation: "Rotate secrets",
    };

    expect(findingMentionedInPrd(requirement, "Fix REM-001 by removing committed .env files")).toBe(true);
    expect(findingMentionedInPrd(requirement, "Unrelated hardening tasks only")).toBe(false);
  });

  it("cross-checks fix PRD against linked security blueprint upload policy", () => {
    const ctx: ProjectContext = {
      appName: "Secure App",
      shortDescription: "Uploads documents",
      fileUpload: true,
    };
    const blueprint = finalizeBlueprint(
      {
        ...finalizeBlueprint(applyGlossaryToBlueprint(buildBlueprintSeedFromWizard(ctx)), ctx),
        uploadPolicy: { allowedTypes: ["application/pdf", "image/png"] },
      },
      ctx
    );

    const securityBlueprint = "Allowed uploads: application/pdf and image/png with auth checks.";
    const prdMissingUpload = "## Fixes\nRotate API keys and patch SQL injection.";

    const issues = validateSecurityFixAgainstBlueprint(blueprint, securityBlueprint, prdMissingUpload);
    expect(issues.some((issue) => issue.category === "security_blueprint_alignment")).toBe(true);
  });
});
