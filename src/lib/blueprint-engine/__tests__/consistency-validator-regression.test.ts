import { describe, expect, it } from "vitest";
import { buildBlueprintSeedFromWizard } from "@/lib/blueprint-engine/extract/from-wizard-context";
import {
  hasBlockingConsistencyErrors,
  validateCrossDocumentConsistency,
} from "@/lib/blueprint-engine/validate/consistency-validator";
import { AI_AGENT_SAAS_WIZARD_INPUT } from "@/lib/blueprint-engine/__tests__/fixtures/ai-agent-saas-golden";
import { buildMockLlmDocuments } from "@/lib/blueprint-engine/__tests__/fixtures/mock-llm-documents";

describe("consistency validator regression suite", () => {
  const blueprint = buildBlueprintSeedFromWizard(AI_AGENT_SAAS_WIZARD_INPUT);
  const baselineDocs = buildMockLlmDocuments(blueprint, AI_AGENT_SAAS_WIZARD_INPUT);

  it("passes when all 10 mock documents align with the canonical model", () => {
    const issues = validateCrossDocumentConsistency(blueprint, baselineDocs);
    expect(hasBlockingConsistencyErrors(issues)).toBe(false);
  });

  it("flags upload-type conflict between app_flow and security_blueprint", () => {
    const issues = validateCrossDocumentConsistency(blueprint, [
      {
        type: "app_flow",
        content: "Users upload .pdf and .png files. Allowed types: PDF, PNG.",
      },
      {
        type: "security_blueprint",
        content: "Allowed upload types: PDF, CSV, and Excel (.xlsx) only.",
      },
    ]);

    expect(hasBlockingConsistencyErrors(issues)).toBe(true);
    expect(issues.some((issue) => issue.message.includes("Upload types differ"))).toBe(true);
  });

  it("flags API endpoint mismatch between backend_schema and trd", () => {
    const apiA = blueprint.apis[0];
    const apiB = blueprint.apis[1] ?? blueprint.apis[0];
    expect(apiA).toBeDefined();

    const issues = validateCrossDocumentConsistency(blueprint, [
      {
        type: "backend_schema",
        content: `${apiA!.method} ${apiA!.path} creates records in approval_requests.`,
      },
      {
        type: "trd",
        content:
          apiB && apiB.path !== apiA!.path
            ? `${apiB.method} ${apiB.path} handles workflow_runs.`
            : "POST /api/noncanonical_resource handles workflow_runs.",
      },
    ]);

    expect(hasBlockingConsistencyErrors(issues)).toBe(true);
    expect(
      issues.some(
        (issue) =>
          issue.message.includes("API endpoints differ") ||
          issue.message.includes("is not in the canonical API catalogue")
      )
    ).toBe(true);
  });

  it("flags entity reference mismatch between backend_schema and trd", () => {
    const issues = validateCrossDocumentConsistency(blueprint, [
      {
        type: "backend_schema",
        content:
          "Tables approval_requests, tool_executions, workflow_runs, agent_versions store tenant data.",
      },
      {
        type: "trd",
        content: "Service layer reads approval_requests only; no tool_executions reference.",
      },
    ]);

    expect(hasBlockingConsistencyErrors(issues)).toBe(true);
    expect(issues.some((issue) => issue.message.includes("Entity references differ"))).toBe(
      true
    );
  });

  it("flags entity reference mismatch between app_flow and backend_schema", () => {
    const issues = validateCrossDocumentConsistency(blueprint, [
      {
        type: "app_flow",
        content: "Screen loads approval_requests and tool_executions for the approver queue.",
      },
      {
        type: "backend_schema",
        content: "Schema defines approval_requests and workflow_runs only.",
      },
    ]);

    expect(hasBlockingConsistencyErrors(issues)).toBe(true);
    expect(
      issues.some(
        (issue) =>
          issue.message.includes("Entity references differ") &&
          issue.documentTypes.includes("app_flow") &&
          issue.documentTypes.includes("backend_schema")
      )
    ).toBe(true);
  });

  it("flags states not defined in the canonical state machine", () => {
    const issues = validateCrossDocumentConsistency(blueprint, [
      {
        type: "app_flow",
        content: "Record moves from PROPOSED to AWAITING_HUMAN_REVIEW then EXECUTING.",
      },
    ]);

    expect(
      issues.some((issue) => issue.message.includes("AWAITING_HUMAN_REVIEW"))
    ).toBe(true);
  });
});
