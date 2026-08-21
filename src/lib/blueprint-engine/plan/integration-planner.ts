import type { ProjectContext } from "@/lib/ai-prompts";
import type { ProjectBlueprint } from "@/lib/zod/blueprint-schemas";
import type { z } from "zod";
import type {
  apiEndpointSchema,
  integrationDefinitionSchema,
  webhookDefinitionSchema,
  integrationFailurePolicySchema,
} from "@/lib/zod/blueprint-schemas";
import {
  classifyFeaturesFromContext,
  type FeatureApiClassification,
} from "@/lib/blueprint-engine/plan/feature-api-classifier";
import {
  classifyIntegration,
  getServiceCapability,
  resolveServiceKey,
} from "@/lib/blueprint-engine/registry/capabilities";

type ApiEndpoint = z.infer<typeof apiEndpointSchema>;
type IntegrationDefinition = z.infer<typeof integrationDefinitionSchema>;
type WebhookDefinition = z.infer<typeof webhookDefinitionSchema>;
type FailurePolicy = z.infer<typeof integrationFailurePolicySchema>;

const DEFAULT_POLICIES: Record<string, FailurePolicy> = {
  database: {
    timeoutMs: 10000,
    maxRetries: 2,
    retryBackoff: "exponential",
    idempotencyKeyRequired: false,
  },
  payment: {
    timeoutMs: 30000,
    maxRetries: 3,
    retryBackoff: "exponential",
    idempotencyKeyRequired: true,
  },
  auth: {
    timeoutMs: 15000,
    maxRetries: 2,
    retryBackoff: "linear",
    idempotencyKeyRequired: false,
  },
  ai: {
    timeoutMs: 60000,
    maxRetries: 2,
    retryBackoff: "linear",
    idempotencyKeyRequired: true,
  },
  workflow: {
    timeoutMs: 120000,
    maxRetries: 3,
    retryBackoff: "exponential",
    idempotencyKeyRequired: true,
  },
  default: {
    timeoutMs: 30000,
    maxRetries: 3,
    retryBackoff: "exponential",
    idempotencyKeyRequired: false,
  },
};

function apiKey(method: string, path: string): string {
  return `${method.toUpperCase()}:${path}`;
}

function nextStableId(prefix: string, index: number): string {
  return `${prefix}-${String(index + 1).padStart(3, "0")}`;
}

function policyForIntegration(name: string, category: string): FailurePolicy {
  const key = resolveServiceKey(name);
  if (key === "neon") return DEFAULT_POLICIES.database;
  if (/stripe|payment|pay/i.test(name)) return DEFAULT_POLICIES.payment;
  if (key === "clerk") return DEFAULT_POLICIES.auth;
  if (key === "openrouter") return DEFAULT_POLICIES.ai;
  if (key === "trigger_dev") return DEFAULT_POLICIES.workflow;
  if (category === "payment") return DEFAULT_POLICIES.payment;
  return DEFAULT_POLICIES.default;
}

function endpointsForFeature(
  feature: FeatureApiClassification,
  integrationId?: string
): ApiEndpoint[] {
  const base = feature.suggestedEntity
    ? `/api/${feature.suggestedEntity}`
    : `/api/${feature.featureKey}`;

  if (feature.delivery === "webhook") {
    return [];
  }

  if (feature.delivery === "async") {
    return [
      {
        id: "",
        method: "POST",
        path: `/api/jobs/${feature.featureKey}`,
        purpose: `Enqueue async processing for: ${feature.label}`,
        authRequired: true,
        idempotent: true,
        featureKey: feature.featureKey,
        accessPattern: "write",
        delivery: "async",
        linkedIntegrationId: integrationId,
      },
    ];
  }

  const endpoints: ApiEndpoint[] = [];
  if (feature.accessPattern === "read" || feature.accessPattern === "read_write") {
    endpoints.push({
      id: "",
      method: "GET",
      path: base,
      purpose: `List or fetch data for: ${feature.label}`,
      authRequired: true,
      idempotent: true,
      featureKey: feature.featureKey,
      accessPattern: "read",
      delivery: "sync",
      linkedIntegrationId: integrationId,
    });
  }
  if (feature.accessPattern === "write" || feature.accessPattern === "read_write") {
    endpoints.push({
      id: "",
      method: "POST",
      path: base,
      purpose: `Create or mutate data for: ${feature.label}`,
      authRequired: true,
      idempotent: false,
      featureKey: feature.featureKey,
      accessPattern: "write",
      delivery: "sync",
      linkedIntegrationId: integrationId,
    });
  }
  return endpoints;
}

function assignStableApiIds(endpoints: ApiEndpoint[]): ApiEndpoint[] {
  return endpoints.map((endpoint, index) => ({
    ...endpoint,
    id: endpoint.id || nextStableId("API", index),
  }));
}

function mergeApiCatalogue(existing: ApiEndpoint[], planned: ApiEndpoint[]): ApiEndpoint[] {
  const byKey = new Map<string, ApiEndpoint>();
  for (const endpoint of existing) {
    byKey.set(apiKey(endpoint.method, endpoint.path), endpoint);
  }
  for (const endpoint of planned) {
    const key = apiKey(endpoint.method, endpoint.path);
    if (!byKey.has(key)) {
      byKey.set(key, endpoint);
    }
  }
  const merged = [...byKey.values()].sort((a, b) => a.path.localeCompare(b.path));
  return assignStableApiIds(merged);
}

function enrichIntegrations(integrations: IntegrationDefinition[]): IntegrationDefinition[] {
  return integrations.map((integration, index) => {
    const capability = getServiceCapability(integration.name);
    const failurePolicy =
      integration.failurePolicy ?? policyForIntegration(integration.name, integration.category);
    return {
      ...integration,
      id: integration.id || nextStableId("INT", index),
      webhooks: integration.webhooks || Boolean(capability?.supportsWebhooks),
      retryPolicy: integration.retryPolicy || failurePolicy.maxRetries > 0,
      verified: integration.verified ?? classifyIntegration(integration.name).verified,
      verificationStatus:
        integration.verificationStatus ?? classifyIntegration(integration.name).verificationStatus,
      failurePolicy,
    };
  });
}

function buildWebhooksFromIntegrations(
  integrations: IntegrationDefinition[],
  existing: WebhookDefinition[]
): WebhookDefinition[] {
  const webhooks = [...existing];
  const known = new Set(webhooks.map((w) => `${w.provider}:${w.event}`));

  for (const integration of integrations) {
    if (!integration.webhooks) continue;
    const key = resolveServiceKey(integration.name);
    const provider = integration.name;

    const events: string[] =
      key === "clerk"
        ? ["user.created", "session.created"]
        : /stripe|payment/i.test(integration.name)
          ? ["payment_intent.succeeded", "customer.subscription.updated"]
          : key === "trigger_dev"
            ? ["run.completed", "run.failed"]
            : [`${integration.name.toLowerCase().replace(/\s+/g, ".")}.event`];

    for (const event of events) {
      const signature = `${provider}:${event}`;
      if (known.has(signature)) continue;
      known.add(signature);
      webhooks.push({
        id: nextStableId("WH", webhooks.length),
        provider,
        event,
        endpoint: `/api/webhooks/${slugifyProvider(provider)}`,
        signatureVerification: true,
      });
    }
  }

  return webhooks;
}

function slugifyProvider(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function workflowIntegrationId(blueprint: ProjectBlueprint): string | undefined {
  return blueprint.integrations.find(
    (i) => resolveServiceKey(i.name) === "trigger_dev" || /trigger/i.test(i.name)
  )?.id;
}

/** Populate apis, integrations, and webhooks from features and stack. */
export function planIntegrationLayer(
  blueprint: ProjectBlueprint,
  ctx?: Pick<ProjectContext, "mainFeatures" | "adminFeatures" | "integrationNeeds" | "paymentProvider">
): ProjectBlueprint {
  const entityNames = Object.keys(blueprint.entities);
  const features = ctx ? classifyFeaturesFromContext(ctx, entityNames) : [];
  const workflowId = workflowIntegrationId(blueprint);

  const plannedApis: ApiEndpoint[] = [];
  for (const feature of features) {
    const linkedId = feature.delivery === "async" ? workflowId : undefined;
    plannedApis.push(...endpointsForFeature(feature, linkedId));
  }

  for (const entity of entityNames) {
    const hasEntityApi = plannedApis.some((api) => api.path.includes(`/${entity}`));
    if (!hasEntityApi) {
      plannedApis.push(
        {
          id: "",
          method: "GET",
          path: `/api/${entity}`,
          purpose: `List ${entity} records`,
          authRequired: true,
          idempotent: true,
          featureKey: entity,
          accessPattern: "read",
          delivery: "sync",
        },
        {
          id: "",
          method: "POST",
          path: `/api/${entity}`,
          purpose: `Create ${entity} record`,
          authRequired: true,
          idempotent: false,
          featureKey: entity,
          accessPattern: "write",
          delivery: "sync",
        }
      );
    }
  }

  const apis = mergeApiCatalogue(blueprint.apis, plannedApis);
  const integrations = enrichIntegrations(blueprint.integrations);
  const webhooks = buildWebhooksFromIntegrations(integrations, blueprint.webhooks);

  return {
    ...blueprint,
    apis,
    integrations,
    webhooks,
  };
}

export function applyIntegrationPlan(
  blueprint: ProjectBlueprint,
  ctx?: Pick<
    ProjectContext,
    "mainFeatures" | "adminFeatures" | "integrationNeeds" | "paymentProvider"
  >
): ProjectBlueprint {
  return planIntegrationLayer(blueprint, ctx);
}

export { DEFAULT_POLICIES, mergeApiCatalogue, assignStableApiIds };
