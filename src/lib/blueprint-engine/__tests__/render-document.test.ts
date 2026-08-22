import { describe, expect, it } from "vitest";
import { buildBlueprintSeedFromWizard } from "@/lib/blueprint-engine/extract/from-wizard-context";
import { finalizeBlueprint } from "@/lib/blueprint-engine/plan/finalize-blueprint";
import {
  renderDocument,
  BLUEPRINT_DOCUMENT_TYPES,
  getSectionsForDocument,
} from "@/lib/blueprint-engine/render/render-document";
import { enforceTerminologyOnContent } from "@/lib/blueprint-engine/validate/enforce-terminology";
import type { ProjectContext } from "@/lib/ai-prompts";

const ctx: ProjectContext = {
  appName: "Skola Workforce",
  shortDescription: "AI agent platform with approvals",
  mainFeatures: "Approve agent actions; Export workforce reports",
  hostingProvider: "Vercel",
  database: "Neon PostgreSQL",
  authProvider: "Clerk",
  multiTenancy: true,
  fileUpload: true,
};

describe("renderDocument", () => {
  const blueprint = finalizeBlueprint(buildBlueprintSeedFromWizard(ctx), ctx);

  it("renders all 10 document types with model binding", () => {
    for (const docType of BLUEPRINT_DOCUMENT_TYPES) {
      const prompt = renderDocument(docType, blueprint, ctx);
      expect(prompt.length).toBeGreaterThan(500);
      expect(prompt).toContain("MODEL-DRIVEN RENDER RULES");
      expect(prompt).toContain("CANONICAL PROJECT MODEL");
      expect(prompt).toContain("tool_executions");
    }
  });

  it("includes section filters per document type", () => {
    const trdSections = getSectionsForDocument("trd");
    const trdPrompt = renderDocument("trd", blueprint, ctx);
    expect(trdSections).toContain("apis");
    expect(trdPrompt).toContain('"apis"');
    expect(trdPrompt).toContain("API-001");
  });

  it("includes security-before-agent ordering in implementation plan", () => {
    const prompt = renderDocument("implementation_plan", blueprint, ctx);
    expect(prompt).toContain("Week 1");
    expect(prompt).toContain("foundational security");
    expect(prompt).toContain("approval_requests");
  });

  it("includes dedicated renderers for new document types", () => {
    expect(renderDocument("api_integration_spec", blueprint, ctx)).toContain("API & Integration Specification");
    expect(renderDocument("testing_qa_plan", blueprint, ctx)).toContain("Requirement traceability matrix");
    expect(renderDocument("deployment_ops_plan", blueprint, ctx)).toContain("Backup & recovery runbook");
  });
});

describe("unknown entity lint", () => {
  it("fails generation when document introduces entities not in model", () => {
    const blueprint = finalizeBlueprint(buildBlueprintSeedFromWizard(ctx), ctx);
    const result = enforceTerminologyOnContent(
      blueprint,
      "The `approval_tasks` table links to `custom_ledger_entries` for payroll.",
      "backend_schema"
    );

    expect(result.passed).toBe(false);
    expect(result.issues.some((issue) => issue.category === "entity_registry")).toBe(true);
  });

  it("passes when document uses only canonical entity names", () => {
    const blueprint = finalizeBlueprint(buildBlueprintSeedFromWizard(ctx), ctx);
    const result = enforceTerminologyOnContent(
      blueprint,
      "The approval_requests table references workflow_runs and tool_executions.",
      "backend_schema"
    );

    expect(result.passed).toBe(true);
  });
});
