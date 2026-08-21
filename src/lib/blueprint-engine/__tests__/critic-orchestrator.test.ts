import { describe, expect, it } from "vitest";
import { buildBlueprintSeedFromWizard } from "@/lib/blueprint-engine/extract/from-wizard-context";
import { applyGlossaryToBlueprint } from "@/lib/blueprint-engine/registry/glossary-builder";
import { runArchitectCritic, MAX_CRITIC_ITERATIONS } from "@/lib/blueprint-engine/critic/critic-orchestrator";
import { runBlueprintValidation } from "@/lib/blueprint-engine/validate/readiness";
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

describe("architect critic", () => {
  it("fixes terminology drift via model patch + single doc regen", async () => {
    const fullBlueprint = applyGlossaryToBlueprint(buildBlueprintSeedFromWizard(aiAgentContext));
    const incompleteBlueprint = {
      ...fullBlueprint,
      glossary: fullBlueprint.glossary.map((entry) =>
        entry.canonical === "workflow_runs"
          ? {
              ...entry,
              rejectedSynonyms: entry.rejectedSynonyms.filter(
                (synonym) => synonym !== "job_runs" && synonym !== "agent_runs"
              ),
            }
          : entry
      ),
    };

    const result = await runArchitectCritic({
      blueprint: incompleteBlueprint,
      documents: [{ type: "backend_schema", content: FIXTURE_WITH_DRIFT }],
    });

    expect(result.iterations).toBeGreaterThanOrEqual(1);
    expect(result.iterations).toBeLessThanOrEqual(MAX_CRITIC_ITERATIONS);
    expect(
      result.patches.some(
        (patch) => patch.kind === "glossary_synonym" || patch.kind === "glossary_expanded"
      )
    ).toBe(true);
    expect(result.regenTargets).toContain("backend_schema");

    const regened = result.documents.find((doc) => doc.type === "backend_schema");
    expect(regened?.content).toContain("workflow_runs");
    expect(regened?.content).toContain("approval_requests");
    expect(regened?.content).toContain("tool_executions");
    expect(regened?.content).not.toMatch(/\bjob_runs\b/);
    expect(regened?.content).not.toMatch(/\bapproval_tasks\b/);

    const validation = runBlueprintValidation(result.blueprint, result.documents);
    const terminologyErrors = validation.issues.filter(
      (issue) => issue.category === "terminology" && issue.severity === "error"
    );
    expect(terminologyErrors).toHaveLength(0);
  });

  it("stops after max critic iterations with unresolved issues", async () => {
    const blueprint = applyGlossaryToBlueprint(buildBlueprintSeedFromWizard(aiAgentContext));
    const invalidFlow = `
## App Flow
The workflow jumps from PROPOSED to SUCCEEDED without approval.
The UI shows the action has been executed while still in PENDING_APPROVAL.
`;

    const result = await runArchitectCritic({
      blueprint,
      documents: [{ type: "app_flow", content: invalidFlow }],
      maxIterations: MAX_CRITIC_ITERATIONS,
    });

    expect(result.iterations).toBeLessThanOrEqual(MAX_CRITIC_ITERATIONS);
    expect(result.unresolvedIssueIds.length).toBeGreaterThan(0);
    expect(
      result.issues.some(
        (issue) => issue.category === "state_machine" && issue.severity === "error"
      )
    ).toBe(true);
  });
});
