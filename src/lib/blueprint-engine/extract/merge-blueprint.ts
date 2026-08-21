import {
  projectBlueprintSchema,
  type ProjectBlueprint,
} from "@/lib/zod/blueprint-schemas";
import { applyGlossaryToBlueprint } from "@/lib/blueprint-engine/registry/glossary-builder";
import { applyIntegrationPlan } from "@/lib/blueprint-engine/plan/integration-planner";
import { applyStackLock } from "@/lib/blueprint-engine/validate/stack-lock";

export function extractJsonObject(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1]?.trim() ?? raw.trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error("LLM did not return valid JSON for blueprint model");
  }
}

export function mergeBlueprint(
  seed: ProjectBlueprint,
  enriched: Partial<ProjectBlueprint>
): ProjectBlueprint {
  const merged = projectBlueprintSchema.parse({
    ...seed,
    ...enriched,
    version: 1,
    generatedAt: seed.generatedAt,
    product: { ...seed.product, ...enriched.product },
    classification: { ...seed.classification, ...enriched.classification },
    stack: { ...seed.stack, ...enriched.stack, locked: true },
    embedding: enriched.embedding ?? seed.embedding,
    entities: { ...seed.entities, ...enriched.entities },
    glossary: enriched.glossary?.length ? enriched.glossary : seed.glossary,
    roles: { ...seed.roles, ...enriched.roles },
    permissions:
      enriched.permissions && Object.keys(enriched.permissions).length > 0
        ? enriched.permissions
        : seed.permissions,
    workflows: { ...seed.workflows, ...enriched.workflows },
    stateMachines: enriched.stateMachines?.length
      ? enriched.stateMachines
      : seed.stateMachines,
    apis: enriched.apis?.length ? enriched.apis : seed.apis,
    integrations: enriched.integrations?.length
      ? enriched.integrations
      : seed.integrations,
    webhooks: enriched.webhooks?.length ? enriched.webhooks : seed.webhooks,
    aiTools: enriched.aiTools?.length ? enriched.aiTools : seed.aiTools,
    requirements: {
      functional: enriched.requirements?.functional?.length
        ? enriched.requirements.functional
        : seed.requirements.functional,
      nonFunctional: enriched.requirements?.nonFunctional?.length
        ? enriched.requirements.nonFunctional
        : seed.requirements.nonFunctional,
    },
    testing: enriched.testing ?? seed.testing,
    deployment: { ...seed.deployment, ...enriched.deployment },
    assumptions: enriched.assumptions?.length ? enriched.assumptions : seed.assumptions,
    metadata: { ...seed.metadata, ...enriched.metadata },
  });

  return applyStackLock(
    applyIntegrationPlan(applyGlossaryToBlueprint(merged))
  );
}
