import { describe, expect, it } from "vitest";
import { buildBlueprintSeedFromWizard } from "@/lib/blueprint-engine/extract/from-wizard-context";
import { applyGlossaryToBlueprint } from "@/lib/blueprint-engine/registry/glossary-builder";
import {
  applySynonymReplacements,
  enforceTerminologyOnContent,
} from "@/lib/blueprint-engine/validate/enforce-terminology";
import { lintTerminology } from "@/lib/blueprint-engine/validate/terminology-lint";
import type { ProjectContext } from "@/lib/ai-prompts";

const aiAgentContext: ProjectContext = {
  appName: "Skola Workforce",
  shortDescription: "AI-powered business operations platform with agents and approvals",
  userRoles: "Owner, Business Admin, Approver",
  multiTenancy: true,
};

const FIXTURE_WITH_DRIFT = `
## Backend Schema

The \`approval_tasks\` table stores pending agent_actions linked to agent_runs.
When a tool_calls record is created, the workflow promotes the job_runs row.
Business Admin can review confirmation_tasks before execution.
`;

describe("glossary builder", () => {
  it("derives entity and role glossary from blueprint model", () => {
    const seed = applyGlossaryToBlueprint(buildBlueprintSeedFromWizard(aiAgentContext));
    expect(seed.glossary.some((g) => g.canonical === "approval_requests")).toBe(true);
    expect(seed.glossary.some((g) => g.canonical === "tool_executions")).toBe(true);
    expect(
      seed.glossary.find((g) => g.canonical === "approval_requests")?.rejectedSynonyms
    ).toContain("approval_tasks");
  });
});

describe("terminology fixtures", () => {
  it("lint catches known synonym drift in fixture documents", () => {
    const blueprint = applyGlossaryToBlueprint(buildBlueprintSeedFromWizard(aiAgentContext));
    const { issues } = lintTerminology(blueprint, FIXTURE_WITH_DRIFT, "backend_schema");
    const terms = issues.map((i) => i.message);
    expect(terms.some((m) => m.includes("approval_tasks"))).toBe(true);
    expect(terms.some((m) => m.includes("agent_runs"))).toBe(true);
    expect(issues.filter((i) => i.severity === "error").length).toBeGreaterThanOrEqual(3);
  });

  it("auto-replaces rejected synonyms with canonical names", () => {
    const blueprint = applyGlossaryToBlueprint(buildBlueprintSeedFromWizard(aiAgentContext));
    const result = enforceTerminologyOnContent(blueprint, FIXTURE_WITH_DRIFT, "backend_schema");

    expect(result.content).toContain("approval_requests");
    expect(result.content).toContain("workflow_runs");
    expect(result.content).toContain("tool_executions");
    expect(result.content).not.toMatch(/\bapproval_tasks\b/);
    expect(result.replacements.length).toBeGreaterThan(0);
    expect(result.passed).toBe(true);
  });

  it("applySynonymReplacements is idempotent", () => {
    const blueprint = applyGlossaryToBlueprint(buildBlueprintSeedFromWizard(aiAgentContext));
    const first = applySynonymReplacements(FIXTURE_WITH_DRIFT, blueprint);
    const second = applySynonymReplacements(first.content, blueprint);
    expect(second.content).toBe(first.content);
    expect(second.replacements).toHaveLength(0);
  });
});
