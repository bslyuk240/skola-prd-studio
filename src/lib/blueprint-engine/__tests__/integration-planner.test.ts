import { describe, expect, it } from "vitest";
import { buildBlueprintSeedFromWizard } from "@/lib/blueprint-engine/extract/from-wizard-context";
import {
  classifyFeatureApiNeed,
  classifyFeaturesFromContext,
} from "@/lib/blueprint-engine/plan/feature-api-classifier";
import { planIntegrationLayer } from "@/lib/blueprint-engine/plan/integration-planner";
import {
  getSharedApiCatalogue,
  serializeApiCatalogueForPrompt,
} from "@/lib/blueprint-engine/render/api-catalogue";
import { applyStackLock, enforceStackLockInText } from "@/lib/blueprint-engine/validate/stack-lock";
import type { ProjectContext } from "@/lib/ai-prompts";

const workforceContext: ProjectContext = {
  appName: "Skola Workforce",
  shortDescription: "AI agent platform with approvals and Stripe billing",
  mainFeatures: "Approve agent actions; Export workforce reports; Upload employee documents",
  adminFeatures: "Manage billing webhooks",
  hostingProvider: "Vercel",
  database: "Neon PostgreSQL",
  authProvider: "Clerk",
  paymentProvider: "Stripe",
  integrationNeeds: "Trigger.dev, Stripe, Clerk",
  multiTenancy: true,
  fileUpload: true,
};

describe("feature-api-classifier", () => {
  it("classifies read vs write vs async delivery", () => {
    expect(classifyFeatureApiNeed("Export workforce reports").accessPattern).toBe("read");
    expect(classifyFeatureApiNeed("Approve agent actions").accessPattern).toBe("write");
    expect(classifyFeatureApiNeed("Upload employee documents").delivery).toBe("async");
    expect(classifyFeatureApiNeed("Manage billing webhooks").delivery).toBe("webhook");
  });

  it("parses multiple feature lines from wizard context", () => {
    const features = classifyFeaturesFromContext(workforceContext);
    expect(features.length).toBeGreaterThanOrEqual(3);
  });
});

describe("integration planner", () => {
  it("assigns stable API IDs for planned endpoints", () => {
    const seed = buildBlueprintSeedFromWizard(workforceContext);
    const planned = planIntegrationLayer(seed, workforceContext);

    expect(planned.apis.length).toBeGreaterThan(0);
    expect(planned.apis[0]?.id).toMatch(/^API-\d{3}$/);
    expect(planned.apis.every((api) => api.id.startsWith("API-"))).toBe(true);
  });

  it("adds failure policies and webhook registry entries", () => {
    const seed = buildBlueprintSeedFromWizard(workforceContext);
    const planned = planIntegrationLayer(seed, workforceContext);

    const clerk = planned.integrations.find((i) => /clerk/i.test(i.name));
    expect(clerk?.failurePolicy?.timeoutMs).toBeGreaterThan(0);
    expect(clerk?.retryPolicy).toBe(true);

    expect(planned.webhooks.some((w) => /clerk/i.test(w.provider))).toBe(true);
    expect(planned.webhooks.every((w) => w.signatureVerification)).toBe(true);
  });

  it("produces consistent API IDs for TRD and API Integration doc types", () => {
    const seed = buildBlueprintSeedFromWizard(workforceContext);
    const planned = planIntegrationLayer(seed, workforceContext);

    const trdCatalogue = getSharedApiCatalogue(planned, "trd");
    const apiSpecCatalogue = getSharedApiCatalogue(planned, "api_integration_spec");

    expect(trdCatalogue).toEqual(apiSpecCatalogue);
    expect(trdCatalogue.find((api) => api.featureKey === "approve_agent_actions")?.id).toBe(
      apiSpecCatalogue.find((api) => api.featureKey === "approve_agent_actions")?.id
    );

    const trdBlock = serializeApiCatalogueForPrompt(planned, "trd");
    const apiBlock = serializeApiCatalogueForPrompt(planned, "api_integration_spec");
    expect(trdBlock).toBe(apiBlock);
    expect(trdBlock).toContain("API-001");
  });
});

describe("stack lock", () => {
  it("removes conflicting hosting integrations when stack is locked to Vercel", () => {
    const seed = buildBlueprintSeedFromWizard({
      ...workforceContext,
      hostingProvider: "Vercel",
      integrationNeeds: "Netlify, Clerk",
    });

    const locked = applyStackLock(seed);
    expect(locked.integrations.some((i) => /netlify/i.test(i.name))).toBe(false);
    expect(locked.deployment.provider).toBe("Vercel");
  });

  it("replaces Netlify references in generated text when hosting is Vercel", () => {
    const seed = buildBlueprintSeedFromWizard(workforceContext);
    const corrected = enforceStackLockInText(
      "Deploy serverless functions on Netlify with Netlify background jobs.",
      seed
    );
    expect(corrected).not.toMatch(/\bNetlify\b/);
    expect(corrected).toContain("Vercel");
  });
});
