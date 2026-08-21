import { describe, expect, it } from "vitest";
import { buildBlueprintSeedFromWizard } from "@/lib/blueprint-engine/extract/from-wizard-context";
import { applyGlossaryToBlueprint } from "@/lib/blueprint-engine/registry/glossary-builder";
import { finalizeBlueprint } from "@/lib/blueprint-engine/plan/finalize-blueprint";
import {
  buildIntegrityReport,
} from "@/lib/blueprint-engine/integrity-report";
import type { ProjectContext } from "@/lib/ai-prompts";

const ctx: ProjectContext = {
  appName: "Skola Workforce",
  shortDescription: "AI agent platform",
  multiTenancy: true,
  mainFeatures: "Approve agent actions",
};

describe("integrity report", () => {
  const blueprint = finalizeBlueprint(applyGlossaryToBlueprint(buildBlueprintSeedFromWizard(ctx)), ctx);

  it("returns fail status when blocking errors exist", () => {
    const report = buildIntegrityReport(blueprint, [
      {
        type: "app_flow",
        content: "Upload PDF and PNG files. Workflow: PROPOSED → SUCCEEDED.",
      },
      {
        type: "security_blueprint",
        content: "Allowed uploads: CSV only.",
      },
    ]);

    expect(report.status).toBe("fail");
    expect(report.hasBlockingErrors).toBe(true);
    expect(report.canExport).toBe(false);
    expect(report.errorCount).toBeGreaterThan(0);
  });

  it("returns pass status with checkmark-eligible state when clean", () => {
    const report = buildIntegrityReport(blueprint, []);
    expect(report.errorCount).toBe(0);
    expect(report.hasBlockingErrors).toBe(false);
    expect(report.canExport).toBe(true);
    expect(["pass", "warning"]).toContain(report.status);
  });

  it("exposes category scores for all six dimensions", () => {
    const report = buildIntegrityReport(blueprint, [
      { type: "security_blueprint", content: "Tenant isolation and RBAC policies." },
    ]);

    expect(report.breakdown.conflicts).toBeGreaterThan(0);
    expect(report.breakdown.schema).toBeGreaterThanOrEqual(0);
    expect(report.breakdown.security).toBeGreaterThan(0);
    expect(report.breakdown.assumptions).toBeGreaterThan(0);
    expect(report.breakdown.flow).toBeGreaterThan(0);
    expect(report.breakdown.integrations).toBeGreaterThan(0);
  });
});
