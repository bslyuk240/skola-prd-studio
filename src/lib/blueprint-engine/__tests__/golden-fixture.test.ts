import { describe, expect, it } from "vitest";
import { buildBlueprintSeedFromWizard } from "@/lib/blueprint-engine/extract/from-wizard-context";
import { projectBlueprintSchema } from "@/lib/zod/blueprint-schemas";
import { PROJECT_DOCUMENT_COUNT } from "@/lib/project-document-types";
import {
  AI_AGENT_SAAS_WIZARD_INPUT,
  assertGoldenModelShape,
  EXPECTED_AI_AGENT_ENTITIES,
  EXPECTED_APPROVAL_STATES,
  GOLDEN_MODEL_EXPECTATIONS,
} from "@/lib/blueprint-engine/__tests__/fixtures/ai-agent-saas-golden";

describe("golden fixture — AI agent SaaS wizard input", () => {
  it("parses and matches expected model shape after seed + finalize", () => {
    const blueprint = buildBlueprintSeedFromWizard(AI_AGENT_SAAS_WIZARD_INPUT);
    expect(projectBlueprintSchema.safeParse(blueprint).success).toBe(true);
    expect(() => assertGoldenModelShape(blueprint)).not.toThrow();
  });

  it("includes all canonical AI-agent entities", () => {
    const blueprint = buildBlueprintSeedFromWizard(AI_AGENT_SAAS_WIZARD_INPUT);
    for (const entity of EXPECTED_AI_AGENT_ENTITIES) {
      expect(blueprint.entities[entity]?.tableName).toBe(entity);
    }
  });

  it("defines the full approval lifecycle state machine", () => {
    const blueprint = buildBlueprintSeedFromWizard(AI_AGENT_SAAS_WIZARD_INPUT);
    const sm = blueprint.stateMachines[0];
    expect(sm?.name).toMatch(/approval/i);
    for (const state of EXPECTED_APPROVAL_STATES) {
      expect(sm?.states).toContain(state);
    }
    expect(sm?.terminalStates).toEqual(
      expect.arrayContaining(["SUCCEEDED", "REJECTED", "CANCELLED"])
    );
  });

  it("locks stack and plans integrations without assuming embedding dimensions", () => {
    const blueprint = buildBlueprintSeedFromWizard(AI_AGENT_SAAS_WIZARD_INPUT);
    expect(blueprint.stack.locked).toBe(GOLDEN_MODEL_EXPECTATIONS.stackLocked);
    expect(blueprint.embedding?.dimensions).toBeUndefined();
    expect(blueprint.integrations.length).toBeGreaterThan(0);
    expect(blueprint.apis.length).toBeGreaterThanOrEqual(GOLDEN_MODEL_EXPECTATIONS.apiCountMin);
  });

  it("aligns with 10 project document types", () => {
    expect(PROJECT_DOCUMENT_COUNT).toBe(GOLDEN_MODEL_EXPECTATIONS.documentTypeCount);
  });
});
