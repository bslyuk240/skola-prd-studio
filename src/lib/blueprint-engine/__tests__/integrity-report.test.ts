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

  it("exposes category scores once source documents are ready", () => {
    const report = buildIntegrityReport(blueprint, [
      { type: "backend_schema", content: "Tables for users and agents.", status: "ready" },
      { type: "app_flow", content: "Flow from PROPOSED to APPROVED.", status: "ready" },
      { type: "security_blueprint", content: "Tenant isolation and RBAC policies.", status: "ready" },
      { type: "api_integration_spec", content: "API catalogue.", status: "ready" },
    ]);

    expect(report.breakdown.conflicts).not.toBeNull();
    expect(report.breakdown.schema).not.toBeNull();
    expect(report.breakdown.security).not.toBeNull();
    expect(report.breakdown.assumptions).not.toBeNull();
    expect(report.breakdown.flow).not.toBeNull();
    expect(report.breakdown.integrations).not.toBeNull();
  });

  it("defers schema scoring while backend_schema is generating", () => {
    const report = buildIntegrityReport(blueprint, [
      { type: "backend_schema", content: "", status: "generating" },
    ]);

    expect(report.breakdown.schema).toBeNull();
    expect(report.breakdown.categoryStates.schema).toBe("pending");
    expect(report.breakdown.overall).toBeNull();
  });

  it("merges the same terminology drift found across multiple documents into one issue", () => {
    const report = buildIntegrityReport(blueprint, [
      {
        type: "backend_schema",
        content: "The tool_calls table stores pending work.",
        status: "ready",
      },
      {
        type: "app_flow",
        content: "Approvers review tool_calls before execution.",
        status: "ready",
      },
    ]);

    const driftIssues = report.issues.filter(
      (issue) => issue.id === "TERM-tool_executions-tool_calls"
    );

    expect(driftIssues).toHaveLength(1);
    expect(driftIssues[0].documentTypes.sort()).toEqual(["app_flow", "backend_schema"]);
  });
});
