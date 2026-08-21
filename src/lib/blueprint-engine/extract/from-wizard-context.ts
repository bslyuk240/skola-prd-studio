import type { ProjectContext } from "@/lib/ai-prompts";
import type { ProjectBlueprint } from "@/lib/zod/blueprint-schemas";
import { projectBlueprintSchema } from "@/lib/zod/blueprint-schemas";
import { getServiceCapability, requiresVerification } from "@/lib/blueprint-engine/registry/capabilities";
import { finalizeBlueprint } from "@/lib/blueprint-engine/plan/finalize-blueprint";

function parseRoles(raw: string | undefined): Record<string, { description: string }> {
  if (!raw?.trim()) return {};
  return Object.fromEntries(
    raw
      .split(/[,;\n]/)
      .map((r) => r.trim())
      .filter(Boolean)
      .map((role) => [role.toLowerCase().replace(/\s+/g, "_"), { description: role }])
  );
}

function inferAiAgents(ctx: ProjectContext): boolean {
  const haystack = [
    ctx.shortDescription,
    ctx.longDescription,
    ctx.mainFeatures,
    ctx.integrationNeeds,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /(\bagents?\b|\bai employee\b|\bautonom|\bllm\b|\btool execution\b|\bworkflow run\b)/i.test(
    haystack
  );
}

function inferAsyncProcessing(ctx: ProjectContext): boolean {
  const workflowEngine = ctx.integrationNeeds?.toLowerCase() ?? "";
  return (
    /trigger\.dev|background job|queue|webhook|async/i.test(workflowEngine) ||
    inferAiAgents(ctx)
  );
}

/** Deterministic first pass — LLM enrichment comes in Phase 1. */
export function buildBlueprintSeedFromWizard(ctx: ProjectContext): ProjectBlueprint {
  const now = new Date();
  const hasAiAgents = inferAiAgents(ctx);

  const integrations = [
    ctx.authProvider,
    ctx.database,
    ctx.hostingProvider,
    ctx.fileStorage,
    ctx.paymentProvider,
    ctx.integrationNeeds,
  ]
    .filter(Boolean)
    .flatMap((value) => value!.split(/[,;\n]/).map((v) => v.trim()))
    .filter(Boolean)
    .map((name, index) => ({
      id: `INT-${String(index + 1).padStart(3, "0")}`,
      name,
      category: "service",
      purpose: `Integration with ${name}`,
      protocol: "HTTPS",
      direction: "outbound" as const,
      webhooks: false,
      retryPolicy: false,
      verified: !requiresVerification(name),
    }));

  const entities: ProjectBlueprint["entities"] = {};

  if (ctx.multiTenancy) {
    entities.organizations = {
      id: "ENT-organizations",
      tableName: "organizations",
      description: "Tenant boundary for multi-tenant data isolation",
      fields: [],
      complete: false,
    };
  }

  entities.users = {
    id: "ENT-users",
    tableName: "users",
    description: "Human user accounts",
    fields: [],
    complete: false,
  };

  if (hasAiAgents) {
    entities.agents = {
      id: "ENT-agents",
      tableName: "agents",
      description: "Configurable AI agents",
      fields: [],
      complete: false,
    };
    entities.agent_versions = {
      id: "ENT-agent_versions",
      tableName: "agent_versions",
      description: "Immutable agent prompt and policy snapshots",
      fields: [],
      complete: false,
    };
    entities.workflow_runs = {
      id: "ENT-workflow_runs",
      tableName: "workflow_runs",
      description: "Agent or workflow execution runs",
      fields: [],
      complete: false,
    };
    entities.tool_executions = {
      id: "ENT-tool_executions",
      tableName: "tool_executions",
      description: "Forensic record of tool calls during agent runs",
      fields: [],
      complete: false,
    };
    entities.approval_requests = {
      id: "ENT-approval_requests",
      tableName: "approval_requests",
      description: "Human approval gates for high-risk agent actions",
      fields: [],
      complete: false,
    };
  }

  const glossary = hasAiAgents
    ? [
        {
          canonical: "approval_requests",
          definition: "Human approval gate before a risky agent action executes",
          rejectedSynonyms: ["approval_tasks", "agent_actions", "approvals", "confirmation_tasks"],
        },
        {
          canonical: "workflow_runs",
          definition: "A single agent or automation execution lifecycle",
          rejectedSynonyms: ["agent_runs", "job_runs", "execution_jobs"],
        },
        {
          canonical: "tool_executions",
          definition: "Individual tool invocation within a workflow run",
          rejectedSynonyms: ["tool_calls", "agent_actions", "action_logs"],
        },
      ]
    : [];

  const seed: ProjectBlueprint = {
    version: 1,
    generatedAt: now.toISOString(),
    product: {
      name: ctx.appName,
      type: ctx.appCategory ?? ctx.platformType,
      stage: "mvp",
      securityRequirement:
        ctx.securityLevel === "enterprise"
          ? "enterprise"
          : ctx.securityLevel === "high"
            ? "high"
            : "standard",
    },
    classification: {
      projectType: ctx.appCategory,
      multiTenant: Boolean(ctx.multiTenancy),
      hasFileUpload: Boolean(ctx.fileUpload),
      hasAiAgents,
      hasAsyncProcessing: inferAsyncProcessing(ctx),
      hasRealtime: false,
    },
    stack: {
      frontend: ctx.frontendFramework,
      backend: ctx.backendFramework,
      hosting: ctx.hostingProvider,
      database: ctx.database,
      auth: ctx.authProvider,
      storage: ctx.fileStorage !== "None" ? ctx.fileStorage : undefined,
      payment: ctx.paymentProvider !== "None" ? ctx.paymentProvider : undefined,
      aiGateway: inferAiAgents(ctx) ? "OpenRouter" : undefined,
      workflowEngine: inferAsyncProcessing(ctx) ? "Trigger.dev" : undefined,
      locked: true,
    },
    embedding: inferAiAgents(ctx)
      ? {
          provider: "OpenRouter",
          modelProfile: "EMBEDDING",
          dimensions: undefined,
          distanceFunction: "cosine",
        }
      : undefined,
    entities,
    glossary,
    roles: parseRoles(ctx.userRoles),
    permissions: {},
    workflows: {},
    stateMachines: hasAiAgents
      ? [
          {
            id: "SM-approval-lifecycle",
            name: "Approval and execution lifecycle",
            states: [
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
            ],
            transitions: [
              { from: "PROPOSED", to: "PENDING_APPROVAL" },
              { from: "PENDING_APPROVAL", to: "APPROVED" },
              { from: "PENDING_APPROVAL", to: "REJECTED" },
              { from: "APPROVED", to: "QUEUED" },
              { from: "QUEUED", to: "EXECUTING" },
              { from: "QUEUED", to: "CANCELLED" },
              { from: "EXECUTING", to: "SUCCEEDED" },
              { from: "EXECUTING", to: "FAILED" },
              { from: "FAILED", to: "RETRY_QUEUED" },
              { from: "RETRY_QUEUED", to: "QUEUED" },
            ],
            terminalStates: ["SUCCEEDED", "REJECTED", "CANCELLED"],
          },
        ]
      : [],
    apis: [],
    integrations,
    webhooks: [],
    aiTools: [],
    requirements: { functional: [], nonFunctional: [] },
    testing: { testCases: [] },
    deployment: {
      environments: ["development", "production"],
      provider: ctx.hostingProvider,
      ciSteps: ["lint", "typecheck", "unit_tests", "build"],
    },
    assumptions: [],
    metadata: {
      projectStartDate: null,
      generationDate: now.toISOString().slice(0, 10),
      modelApprovedAt: null,
    },
  };

  return finalizeBlueprint(projectBlueprintSchema.parse(seed), ctx);
}

export function validateBlueprintSeed(seed: ProjectBlueprint): ProjectBlueprint {
  return projectBlueprintSchema.parse(seed);
}

export function summarizeStackVerification(seed: ProjectBlueprint): string[] {
  const notes: string[] = [];
  for (const [key, value] of Object.entries(seed.stack)) {
    if (key === "locked" || !value || typeof value !== "string") continue;
    const capability = getServiceCapability(value);
    if (!capability) {
      notes.push(`${key}: ${value} — VERIFICATION REQUIRED`);
    }
  }
  return notes;
}
