import { describe, expect, it } from "vitest";
import { buildBlueprintSeedFromWizard } from "@/lib/blueprint-engine/extract/from-wizard-context";
import { finalizeBlueprint } from "@/lib/blueprint-engine/plan/finalize-blueprint";
import { planFunctionalRequirements } from "@/lib/blueprint-engine/plan/requirements-planner";
import {
  everyRequirementHasTestCase,
  inferProjectTypeProfile,
  planQaTestCases,
} from "@/lib/blueprint-engine/plan/qa-planner";
import {
  ciStepsForBlueprint,
  environmentsForStage,
  planOperationsModel,
} from "@/lib/blueprint-engine/plan/operations-planner";
import { runBlueprintValidation } from "@/lib/blueprint-engine/validate/readiness";
import type { ProjectContext } from "@/lib/ai-prompts";

const workforceContext: ProjectContext = {
  appName: "Skola Workforce",
  shortDescription: "AI agent platform with approvals",
  mainFeatures: "Approve agent actions; Export workforce reports",
  adminFeatures: "Manage billing webhooks",
  hostingProvider: "Vercel",
  database: "Neon PostgreSQL",
  authProvider: "Clerk",
  paymentProvider: "Stripe",
  integrationNeeds: "Trigger.dev, Stripe, Clerk",
  multiTenancy: true,
  fileUpload: true,
};

describe("requirements planner", () => {
  it("assigns stable FR-* IDs from wizard features", () => {
    const seed = buildBlueprintSeedFromWizard(workforceContext);
    const requirements = planFunctionalRequirements(seed, workforceContext);

    expect(requirements.functional.length).toBeGreaterThanOrEqual(3);
    expect(requirements.functional[0]?.id).toMatch(/^FR-\d{3}$/);
    expect(requirements.functional.every((req, index, all) => all.indexOf(req) === index)).toBe(
      true
    );
  });

  it("adds structural requirements for AI, tenant, and upload products", () => {
    const seed = buildBlueprintSeedFromWizard(workforceContext);
    const requirements = planFunctionalRequirements(seed, workforceContext);
    const statements = requirements.functional.map((req) => req.statement);

    expect(statements.some((s) => s.includes("tenant isolation"))).toBe(true);
    expect(statements.some((s) => s.includes("tool_executions"))).toBe(true);
    expect(statements.some((s) => s.includes("presigned URLs"))).toBe(true);
  });
});

describe("qa planner", () => {
  it("maps every FR-* to at least one test case", () => {
    const finalized = finalizeBlueprint(buildBlueprintSeedFromWizard(workforceContext), workforceContext);

    expect(finalized.requirements.functional.length).toBeGreaterThan(0);
    expect(everyRequirementHasTestCase(finalized)).toBe(true);
    expect(
      finalized.testing.testCases.some((testCase) => testCase.id === "TC-FR-001-01")
    ).toBe(true);
  });

  it("adds AI-agent profile and integration failure tests", () => {
    const seed = buildBlueprintSeedFromWizard(workforceContext);
    const requirements = planFunctionalRequirements(seed, workforceContext);
    const withRequirements = { ...seed, requirements };
    const testing = planQaTestCases(withRequirements);

    expect(inferProjectTypeProfile(seed)).toBe("ai_agent");
    expect(testing.testCases.some((tc) => tc.id.startsWith("TC-PROFILE-AI_AGENT"))).toBe(true);
    expect(testing.testCases.some((tc) => tc.id.startsWith("TC-FAIL-INT-"))).toBe(true);
    expect(testing.testCases.some((tc) => tc.failureScenario?.includes("unavailable"))).toBe(true);
  });
});

describe("operations planner", () => {
  it("derives environments by product stage", () => {
    const mvp = environmentsForStage("mvp");
    const enterprise = environmentsForStage("enterprise");

    expect(mvp.map((env) => env.name)).toEqual(["development", "staging", "production"]);
    expect(enterprise.map((env) => env.name)).toContain("disaster_recovery");
  });

  it("builds CI/CD and backup models from stack", () => {
    const seed = buildBlueprintSeedFromWizard(workforceContext);
    const deployment = planOperationsModel(seed);

    expect(deployment.ciSteps).toContain("integration_tests");
    expect(deployment.ciSteps).toContain("agent_policy_tests");
    expect(deployment.ciPipeline?.stages).toContain("deploy_staging");
    expect(deployment.backupRecovery?.some((item) => /Neon/i.test(item.component))).toBe(true);
  });
});

describe("qa coverage validation", () => {
  it("passes readiness validation when FR coverage is complete", () => {
    const finalized = finalizeBlueprint(buildBlueprintSeedFromWizard(workforceContext), workforceContext);
    const { issues } = runBlueprintValidation(finalized);

    expect(issues.some((issue) => issue.category === "qa_coverage")).toBe(false);
  });
});
