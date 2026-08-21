import { describe, expect, it } from "vitest";
import { buildBlueprintSeedFromWizard } from "@/lib/blueprint-engine/extract/from-wizard-context";
import { finalizeBlueprint } from "@/lib/blueprint-engine/plan/finalize-blueprint";
import { computeReadinessBreakdown } from "@/lib/blueprint-engine/validate/compute-readiness-breakdown";
import type { ProjectContext } from "@/lib/ai-prompts";
import type { ValidationIssue } from "@/lib/zod/blueprint-schemas";

const ctx: ProjectContext = {
  appName: "Readiness Test",
  shortDescription: "AI workforce platform",
  multiTenancy: true,
  mainFeatures: "Agent approvals",
};

describe("computeReadinessBreakdown", () => {
  const blueprint = finalizeBlueprint(buildBlueprintSeedFromWizard(ctx), ctx);

  it("caps overall below 100 when validation errors exist", () => {
    const issues: ValidationIssue[] = [
      {
        id: "ERR-1",
        severity: "error",
        category: "consistency",
        message: "Conflict",
        documentTypes: ["app_flow"],
      },
    ];

    const breakdown = computeReadinessBreakdown(
      blueprint,
      [
        { type: "app_flow", content: "Flow", status: "ready" },
        { type: "backend_schema", content: "Schema", status: "ready" },
        { type: "security_blueprint", content: "Security", status: "ready" },
        { type: "api_integration_spec", content: "APIs", status: "ready" },
      ],
      issues
    );
    expect(breakdown.overall).toBeLessThan(100);
    expect(breakdown.blockers).toContain("validation_errors");
  });

  it("scores below 100 when open security todos remain", () => {
    const breakdown = computeReadinessBreakdown(
      blueprint,
      [
        { type: "app_flow", content: "Flow", status: "ready" },
        { type: "backend_schema", content: "Schema", status: "ready" },
        { type: "security_blueprint", content: "Security controls listed.", status: "ready" },
        { type: "api_integration_spec", content: "API catalogue.", status: "ready" },
      ],
      [],
      { openSecurityTodos: 3, totalSecurityTodos: 5 }
    );

    expect(breakdown.security).not.toBeNull();
    expect(breakdown.security!).toBeLessThan(100);
    expect(breakdown.overall).not.toBeNull();
    expect(breakdown.overall!).toBeLessThan(100);
    expect(breakdown.blockers).toContain("open_security_todos");
  });

  it("allows 100 only when blockers are cleared", () => {
    const completeBlueprint = {
      ...blueprint,
      entities: Object.fromEntries(
        Object.entries(blueprint.entities).map(([key, entity]) => [
          key,
          { ...entity, complete: true, fields: [{ name: "id", type: "uuid" }] },
        ])
      ),
      integrations: blueprint.integrations.map((integration) => ({
        ...integration,
        verified: true,
      })),
      assumptions: [],
    };

    const docs = [
      "prd",
      "trd",
      "app_flow",
      "ux_brief",
      "backend_schema",
      "implementation_plan",
      "security_blueprint",
      "api_integration_spec",
      "testing_qa_plan",
      "deployment_ops_plan",
    ].map((type) => ({
      type,
      content: `Generated ${type} content.`,
      status: "ready" as const,
    }));

    const breakdown = computeReadinessBreakdown(completeBlueprint, docs, [], {
      openSecurityTodos: 0,
      totalSecurityTodos: 0,
    });

    expect(breakdown.blockers).toHaveLength(0);
    expect(breakdown.overall).toBe(100);
  });

  it("returns null overall while generation is in progress", () => {
    const breakdown = computeReadinessBreakdown(
      blueprint,
      [],
      [],
      {},
      [{ type: "backend_schema", status: "generating", content: null }]
    );

    expect(breakdown.generationInProgress).toBe(true);
    expect(breakdown.schema).toBeNull();
    expect(breakdown.overall).toBeNull();
    expect(breakdown.categoryStates.schema).toBe("pending");
  });
});
