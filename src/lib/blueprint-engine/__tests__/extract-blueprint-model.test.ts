import { describe, expect, it } from "vitest";
import { buildBlueprintSeedFromWizard } from "@/lib/blueprint-engine/extract/from-wizard-context";
import { mergeBlueprint } from "@/lib/blueprint-engine/extract/merge-blueprint";
import { extractJsonObject } from "@/lib/blueprint-engine/extract/merge-blueprint";
import type { ProjectContext } from "@/lib/ai-prompts";

const aiAgentContext: ProjectContext = {
  appName: "Skola Workforce",
  shortDescription: "AI-powered business operations platform with agents and approvals",
  hostingProvider: "Vercel",
  database: "Neon PostgreSQL",
  authProvider: "Clerk",
  userRoles: "Owner, Business Admin, Approver, Team Member",
  multiTenancy: true,
};

describe("mergeBlueprint", () => {
  it("merges LLM enrichment without dropping seed entities", () => {
    const seed = buildBlueprintSeedFromWizard(aiAgentContext);
    const merged = mergeBlueprint(seed, {
      permissions: {
        OWNER: ["*"],
        APPROVER: ["approvals.read", "approvals.execute"],
      },
      requirements: {
        functional: [
          {
            id: "FR-001",
            statement: "Managers can approve agent actions",
            priority: "must_have",
            scope: "required_now",
          },
        ],
        nonFunctional: ["Tenant isolation on every query"],
      },
    });

    expect(merged.entities.tool_executions).toBeDefined();
    expect(merged.permissions.OWNER).toContain("*");
    expect(merged.requirements.functional).toHaveLength(1);
  });

  it("prefers enriched glossary when provided", () => {
    const seed = buildBlueprintSeedFromWizard(aiAgentContext);
    const merged = mergeBlueprint(seed, {
      glossary: [
        {
          canonical: "tasks",
          definition: "Work assignment for humans or agents",
          rejectedSynonyms: ["jobs", "work_items"],
        },
      ],
    });

    expect(merged.glossary.find((g) => g.canonical === "tasks")?.definition).toContain(
      "Work assignment"
    );
  });
});

describe("extractJsonObject", () => {
  it("parses fenced JSON", () => {
    const result = extractJsonObject('Here is the model:\n```json\n{"product":{"name":"Test"}}\n```');
    expect(result).toEqual({ product: { name: "Test" } });
  });
});
