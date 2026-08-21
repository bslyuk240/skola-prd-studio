import type { ProjectBlueprint } from "@/lib/zod/blueprint-schemas";

const API_CATALOGUE_DOC_TYPES = new Set([
  "trd",
  "api_integration_spec",
  "backend_schema",
  "implementation_plan",
  "security_blueprint",
]);

/** Shared API catalogue block — same stable IDs for TRD and API Integration doc. */
export function serializeApiCatalogueForPrompt(
  blueprint: ProjectBlueprint,
  documentType: string
): string {
  if (!API_CATALOGUE_DOC_TYPES.has(documentType) || blueprint.apis.length === 0) {
    return "";
  }

  const integrations = blueprint.integrations.map((integration) => ({
    id: integration.id,
    name: integration.name,
    purpose: integration.purpose,
    webhooks: integration.webhooks,
    retryPolicy: integration.retryPolicy,
    failurePolicy: integration.failurePolicy,
  }));

  const webhooks = blueprint.webhooks.map((webhook) => ({
    id: webhook.id,
    provider: webhook.provider,
    event: webhook.event,
    endpoint: webhook.endpoint,
    signatureVerification: webhook.signatureVerification,
  }));

  return `
API & INTEGRATION CATALOGUE (stable IDs — reference exactly as listed, do not renumber):

Endpoints:
\`\`\`json
${JSON.stringify(blueprint.apis, null, 2)}
\`\`\`

Integrations:
\`\`\`json
${JSON.stringify(integrations, null, 2)}
\`\`\`

Webhooks:
\`\`\`json
${JSON.stringify(webhooks, null, 2)}
\`\`\`
`.trim();
}

export function getSharedApiCatalogue(
  blueprint: ProjectBlueprint,
  documentType: string
): ProjectBlueprint["apis"] {
  if (!API_CATALOGUE_DOC_TYPES.has(documentType)) return [];
  return blueprint.apis;
}
