import { describe, expect, it } from "vitest";
import { buildBlueprintSeedFromWizard } from "@/lib/blueprint-engine/extract/from-wizard-context";
import { finalizeBlueprint } from "@/lib/blueprint-engine/plan/finalize-blueprint";
import {
  extractDocumentTransitions,
  validateStateMachineStructure,
  validateStateTransitionsInDocument,
  validateWorkflowDocuments,
} from "@/lib/blueprint-engine/validate/state-machine-validator";
import {
  planAiToolPolicies,
  validateAiToolPolicies,
  DEFAULT_AUTHORIZATION_CHAIN,
} from "@/lib/blueprint-engine/validate/ai-action-policy";
import type { ProjectContext } from "@/lib/ai-prompts";

const ctx: ProjectContext = {
  appName: "Skola Workforce",
  shortDescription: "AI agent platform with approvals",
  mainFeatures: "Approve agent actions",
  multiTenancy: true,
};

const INVALID_TRANSITION_DOC = `
## Approval Flow
When a manager approves an action, the workflow moves from PROPOSED to SUCCEEDED immediately.
The UI shows the action has been executed while still in PENDING_APPROVAL.
`;

describe("state machine validator", () => {
  const blueprint = finalizeBlueprint(buildBlueprintSeedFromWizard(ctx), ctx);

  it("validates canonical state machine structure", () => {
    const issues = validateStateMachineStructure(blueprint);
    expect(issues).toHaveLength(0);
    expect(blueprint.stateMachines[0]?.states).toContain("PENDING_APPROVAL");
  });

  it("extracts transitions from document text", () => {
    const transitions = extractDocumentTransitions("PROPOSED → PENDING_APPROVAL → APPROVED");
    expect(transitions).toContainEqual({ from: "PROPOSED", to: "PENDING_APPROVAL" });
    expect(transitions).toContainEqual({ from: "PENDING_APPROVAL", to: "APPROVED" });
  });

  it("flags invalid state transition in fixture doc", () => {
    const issues = validateStateTransitionsInDocument(
      blueprint,
      INVALID_TRANSITION_DOC,
      "app_flow"
    );

    expect(
      issues.some(
        (issue) =>
          issue.category === "state_machine" &&
          issue.message.includes("PROPOSED") &&
          issue.message.includes("SUCCEEDED")
      )
    ).toBe(true);
    expect(issues.some((issue) => issue.message.includes("STATE MACHINE ERROR"))).toBe(true);
  });

  it("flags premature executed copy before SUCCEEDED", () => {
    const issues = validateWorkflowDocuments(blueprint, [
      { type: "app_flow", content: INVALID_TRANSITION_DOC },
    ]);

    expect(issues.some((issue) => issue.message.toLowerCase().includes("execut"))).toBe(true);
  });
});

describe("ai action policy", () => {
  it("plans default tool risk taxonomy for AI products", () => {
    const seed = buildBlueprintSeedFromWizard(ctx);
    const planned = planAiToolPolicies(seed);

    expect(planned.aiTools.length).toBeGreaterThanOrEqual(5);
    expect(planned.aiActionPolicy?.authorizationChain).toEqual([
      ...DEFAULT_AUTHORIZATION_CHAIN,
    ]);
    expect(
      planned.aiTools.find((tool) => tool.risk === "FINANCIAL_WRITE")?.approvalRequired
    ).toBe(true);
  });

  it("requires idempotency for mutating tool risks", () => {
    const seed = buildBlueprintSeedFromWizard(ctx);
    const planned = planAiToolPolicies({
      ...seed,
      aiTools: [
        {
          toolName: "bad_tool",
          risk: "EXTERNAL_COMMUNICATION",
          approvalRequired: false,
          idempotencyRequired: false,
        },
      ],
    });

    const issues = validateAiToolPolicies(planned);
    expect(issues.some((issue) => issue.message.includes("approvalRequired"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("idempotencyRequired"))).toBe(true);
  });
});
