import { describe, expect, it } from "vitest";
import { buildBlueprintSeedFromWizard } from "@/lib/blueprint-engine/extract/from-wizard-context";
import { lintTerminology } from "@/lib/blueprint-engine/validate/terminology-lint";
import { runBlueprintValidation } from "@/lib/blueprint-engine/validate/readiness";
import { serializeBlueprintForPrompt } from "@/lib/blueprint-engine/render/prompt-context";
import { getServiceCapability, detectStackConflicts } from "@/lib/blueprint-engine/registry/capabilities";
import { projectBlueprintSchema } from "@/lib/zod/blueprint-schemas";
import type { ProjectContext } from "@/lib/ai-prompts";

const aiAgentContext: ProjectContext = {
  appName: "Skola Workforce",
  shortDescription: "AI-powered business operations platform with agents and approvals",
  hostingProvider: "Vercel",
  database: "Neon PostgreSQL",
  authProvider: "Clerk",
  frontendFramework: "Next.js",
  backendFramework: "Next.js Route Handlers",
  integrationNeeds: "Trigger.dev, OpenRouter",
  multiTenancy: true,
  fileUpload: true,
  userRoles: "Owner, Business Admin, Approver, Team Member",
  securityLevel: "enterprise",
};

describe("projectBlueprintSchema", () => {
  it("parses a valid seed blueprint", () => {
    const seed = buildBlueprintSeedFromWizard(aiAgentContext);
    expect(projectBlueprintSchema.safeParse(seed).success).toBe(true);
  });
});

describe("buildBlueprintSeedFromWizard", () => {
  it("adds AI agent entities and glossary for agent products", () => {
    const seed = buildBlueprintSeedFromWizard(aiAgentContext);
    expect(seed.entities.tool_executions).toBeDefined();
    expect(seed.entities.agent_versions).toBeDefined();
    expect(seed.entities.workflow_runs).toBeDefined();
    expect(seed.entities.approval_requests).toBeDefined();
    expect(seed.glossary.some((g) => g.canonical === "approval_requests")).toBe(true);
  });

  it("includes approval lifecycle state machine", () => {
    const seed = buildBlueprintSeedFromWizard(aiAgentContext);
    expect(seed.stateMachines[0]?.states).toContain("PENDING_APPROVAL");
    expect(seed.stateMachines[0]?.states).toContain("SUCCEEDED");
  });

  it("does not assume embedding dimensions", () => {
    const seed = buildBlueprintSeedFromWizard(aiAgentContext);
    expect(seed.embedding?.dimensions).toBeUndefined();
  });
});

describe("capability registry", () => {
  it("recognises Vercel and Clerk", () => {
    expect(getServiceCapability("Vercel")?.provider).toBe("Vercel");
    expect(getServiceCapability("Clerk")?.supportsOAuth).toBe(true);
  });

  it("detects hosting stack conflicts", () => {
    const conflicts = detectStackConflicts({
      hosting: "Vercel",
      backend: "Netlify Functions",
    });
    expect(conflicts.length).toBeGreaterThan(0);
  });
});

describe("terminology lint", () => {
  it("flags rejected synonyms", () => {
    const seed = buildBlueprintSeedFromWizard(aiAgentContext);
    const result = lintTerminology(
      seed,
      "The approval_tasks table stores pending agent_actions.",
      "backend_schema"
    );
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
    expect(result.issues.every((i) => i.severity === "error")).toBe(true);
  });
});

describe("runBlueprintValidation", () => {
  it("caps overall readiness below 90 when errors exist", () => {
    const seed = buildBlueprintSeedFromWizard(aiAgentContext);
    const { breakdown, issues } = runBlueprintValidation(seed, [
      {
        type: "backend_schema",
        content: "Uses approval_tasks and agent_runs throughout.",
        status: "ready",
      },
      {
        type: "app_flow",
        content: "Uses approval_tasks throughout the flow.",
        status: "ready",
      },
      {
        type: "security_blueprint",
        content: "Security controls for approval_tasks.",
        status: "ready",
      },
      {
        type: "api_integration_spec",
        content: "POST /api/approval_requests",
        status: "ready",
      },
    ]);
    expect(issues.some((i) => i.severity === "error")).toBe(true);
    expect(breakdown.overall).not.toBeNull();
    expect(breakdown.overall!).toBeLessThanOrEqual(89);
  });

  it("requires tool_executions for AI products missing from model", () => {
    const seed = buildBlueprintSeedFromWizard({
      appName: "Simple App",
      shortDescription: "A notes app",
    });
    delete seed.entities.tool_executions;
    seed.classification.hasAiAgents = true;
    const { issues } = runBlueprintValidation(seed);
    expect(issues.some((i) => i.message.includes("tool_executions"))).toBe(true);
  });
});

describe("serializeBlueprintForPrompt", () => {
  it("includes glossary lock instructions", () => {
    const seed = buildBlueprintSeedFromWizard(aiAgentContext);
    const block = serializeBlueprintForPrompt(seed, ["product", "stack", "glossary", "entities"]);
    expect(block).toContain("TERMINOLOGY REGISTRY");
    expect(block).toContain("approval_requests");
    expect(block).toContain("Do not invent alternate table names");
  });
});
