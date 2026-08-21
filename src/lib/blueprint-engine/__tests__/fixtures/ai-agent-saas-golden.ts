import type { ProjectContext } from "@/lib/ai-prompts";
import type { ProjectBlueprint } from "@/lib/zod/blueprint-schemas";

/** Golden wizard input — AI agent SaaS with approvals, multi-tenancy, and file upload. */
export const AI_AGENT_SAAS_WIZARD_INPUT: ProjectContext = {
  appName: "Skola Workforce",
  shortDescription:
    "AI-powered business operations platform with agents, approvals, and workforce automation",
  mainFeatures:
    "Approve agent actions; Run scheduled workflows; Upload employee documents; Export workforce reports",
  adminFeatures: "Manage tenant settings and billing webhooks",
  hostingProvider: "Vercel",
  database: "Neon PostgreSQL",
  authProvider: "Clerk",
  frontendFramework: "Next.js",
  backendFramework: "Next.js Route Handlers",
  integrationNeeds: "Trigger.dev, OpenRouter, Stripe",
  paymentProvider: "Stripe",
  multiTenancy: true,
  fileUpload: true,
  userRoles: "Owner, Business Admin, Approver, Team Member",
  securityLevel: "enterprise",
};

/** Canonical AI-agent entities expected after seed + finalize. */
export const EXPECTED_AI_AGENT_ENTITIES = [
  "approval_requests",
  "agent_versions",
  "tool_executions",
  "workflow_runs",
] as const;

/** Approval lifecycle states from the canonical state machine. */
export const EXPECTED_APPROVAL_STATES = [
  "PROPOSED",
  "PENDING_APPROVAL",
  "APPROVED",
  "QUEUED",
  "EXECUTING",
  "SUCCEEDED",
  "REJECTED",
  "CANCELLED",
  "FAILED",
  "RETRY_QUEUED",
] as const;

/** Glossary canonicals that must appear for agent products. */
export const EXPECTED_GLOSSARY_CANONICALS = [
  "approval_requests",
  "tool_executions",
  "workflow_runs",
  "agent_versions",
] as const;

export type GoldenModelExpectations = {
  entityKeys: readonly string[];
  stateMachineStates: readonly string[];
  glossaryCanonicals: readonly string[];
  hasAiAgents: boolean;
  stackLocked: boolean;
  embeddingDimensionsUndefined: boolean;
  apiCountMin: number;
  documentTypeCount: number;
};

export const GOLDEN_MODEL_EXPECTATIONS: GoldenModelExpectations = {
  entityKeys: EXPECTED_AI_AGENT_ENTITIES,
  stateMachineStates: EXPECTED_APPROVAL_STATES,
  glossaryCanonicals: EXPECTED_GLOSSARY_CANONICALS,
  hasAiAgents: true,
  stackLocked: true,
  embeddingDimensionsUndefined: true,
  apiCountMin: 1,
  documentTypeCount: 10,
};

/** Assert a finalized blueprint matches the golden AI-agent SaaS shape. */
export function assertGoldenModelShape(blueprint: ProjectBlueprint): void {
  for (const entity of GOLDEN_MODEL_EXPECTATIONS.entityKeys) {
    if (!blueprint.entities[entity]) {
      throw new Error(`Missing expected entity: ${entity}`);
    }
  }

  const sm = blueprint.stateMachines[0];
  if (!sm) throw new Error("Missing approval lifecycle state machine");

  for (const state of GOLDEN_MODEL_EXPECTATIONS.stateMachineStates) {
    if (!sm.states.includes(state)) {
      throw new Error(`Missing expected state: ${state}`);
    }
  }

  for (const canonical of GOLDEN_MODEL_EXPECTATIONS.glossaryCanonicals) {
    if (!blueprint.glossary.some((entry) => entry.canonical === canonical)) {
      throw new Error(`Missing glossary entry: ${canonical}`);
    }
  }

  if (!blueprint.classification.hasAiAgents) {
    throw new Error("Expected hasAiAgents classification");
  }

  if (!blueprint.stack.locked) {
    throw new Error("Expected stack lock after finalize");
  }

  if (blueprint.embedding?.dimensions !== undefined) {
    throw new Error("Embedding dimensions must not be assumed in seed");
  }

  if (blueprint.apis.length < GOLDEN_MODEL_EXPECTATIONS.apiCountMin) {
    throw new Error("Expected at least one planned API endpoint");
  }
}
