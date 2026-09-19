import { describe, expect, it } from "vitest";
import { buildBlueprintSeedFromWizard } from "@/lib/blueprint-engine/extract/from-wizard-context";
import { applyGlossaryToBlueprint } from "@/lib/blueprint-engine/registry/glossary-builder";
import { finalizeBlueprint } from "@/lib/blueprint-engine/plan/finalize-blueprint";
import {
  isResolvableIssue,
  computeResolutionOptions,
  patchBlueprintFromIssues,
} from "@/lib/blueprint-engine/critic/conflict-resolver";
import type { ProjectBlueprint, ValidationIssue } from "@/lib/zod/blueprint-schemas";
import type { ProjectContext } from "@/lib/ai-prompts";

const ctx: ProjectContext = {
  appName: "Skola Workforce",
  shortDescription: "AI agent platform",
  multiTenancy: true,
  mainFeatures: "Approve agent actions",
};

const baseBlueprint: ProjectBlueprint = finalizeBlueprint(
  applyGlossaryToBlueprint(buildBlueprintSeedFromWizard(ctx)),
  ctx
);

function issue(overrides: Partial<ValidationIssue> & Pick<ValidationIssue, "id" | "category">): ValidationIssue {
  return {
    severity: "error",
    message: "test issue",
    documentTypes: [],
    ...overrides,
  };
}

describe("conflict-resolver: model_completeness (STRUCT-missing-*)", () => {
  it("is resolvable and registers a stub entity", () => {
    const remainingEntities = { ...baseBlueprint.entities };
    delete remainingEntities.tool_executions;
    const blueprintMissingEntity: ProjectBlueprint = {
      ...baseBlueprint,
      entities: remainingEntities,
    };
    expect(blueprintMissingEntity.entities.tool_executions).toBeUndefined();

    const structIssue = issue({
      id: "STRUCT-missing-tool_executions",
      category: "model_completeness",
      message: 'AI agent products require "tool_executions" in the canonical model',
      resolution: "Add entities.tool_executions to the project blueprint",
    });

    expect(isResolvableIssue(structIssue)).toBe(true);

    const result = patchBlueprintFromIssues(blueprintMissingEntity, [structIssue]);

    expect(result.blueprint.entities.tool_executions).toBeDefined();
    expect(result.resolvedIssueIds).toContain(structIssue.id);
    expect(result.patches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "entity_registry", entity: "tool_executions" }),
      ])
    );
  });
});

describe("conflict-resolver: computeResolutionOptions", () => {
  it("returns exactly one option for a resolvable terminology issue", () => {
    const termIssue = issue({
      id: "TERM-tool_executions-tool_calls",
      category: "terminology",
      message: 'Use "tool_executions" instead of "tool_calls"',
      resolution: 'Rename "tool_calls" to "tool_executions"',
      documentTypes: ["backend_schema"],
    });

    const options = computeResolutionOptions(termIssue);
    expect(options).toHaveLength(1);
    expect(options[0]).toEqual({ id: "default", label: termIssue.resolution });
  });

  it("returns no options for an unresolvable qa_coverage issue", () => {
    const qaIssue = issue({
      id: "QA-missing-REQ-001",
      category: "qa_coverage",
      message: 'Requirement "REQ-001" has no linked test case',
      resolution: 'Add at least one test case with requirementId "REQ-001"',
      documentTypes: ["testing_qa_plan"],
    });

    expect(isResolvableIssue(qaIssue)).toBe(false);
    expect(computeResolutionOptions(qaIssue)).toEqual([]);
  });
});

describe("conflict-resolver: entity_registry (ENTITY-UNKNOWN-*)", () => {
  it("is resolvable and registers a stub entity — structural-completeness.ts's per-document check, a separate issue shape from CONSISTENCY-MODEL-ENTITY-", () => {
    const unknownIssue = issue({
      id: "ENTITY-UNKNOWN-freezers",
      category: "entity_registry",
      message: 'Document references unknown table "freezers" not in the canonical model',
      resolution: 'Remove "freezers" or add it to the project blueprint entity registry',
      documentTypes: ["trd"],
    });

    expect(isResolvableIssue(unknownIssue)).toBe(true);
    expect(computeResolutionOptions(unknownIssue)).toHaveLength(1);

    const result = patchBlueprintFromIssues(baseBlueprint, [unknownIssue]);

    expect(result.blueprint.entities.freezers).toBeDefined();
    expect(result.resolvedIssueIds).toContain(unknownIssue.id);
    expect(result.patches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "entity_registry", entity: "freezers", sourceDocument: "trd" }),
      ])
    );
  });
});

describe("conflict-resolver: backward compatibility", () => {
  it("applies the existing single-patch behavior unchanged when no selections map is passed", () => {
    const entityIssue = issue({
      id: "CONSISTENCY-MODEL-ENTITY-backend_schema-widgets",
      category: "consistency",
      message: 'Document references unregistered entity "widgets"',
      documentTypes: ["backend_schema"],
    });

    const result = patchBlueprintFromIssues(baseBlueprint, [entityIssue]);

    expect(result.blueprint.entities.widgets).toBeDefined();
    expect(result.resolvedIssueIds).toContain(entityIssue.id);
  });
});
