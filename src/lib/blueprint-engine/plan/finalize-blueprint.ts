import type { ProjectContext } from "@/lib/ai-prompts";
import type { ProjectBlueprint } from "@/lib/zod/blueprint-schemas";
import { applyGlossaryToBlueprint } from "@/lib/blueprint-engine/registry/glossary-builder";
import { applyIntegrationPlan } from "@/lib/blueprint-engine/plan/integration-planner";
import { applyQaAndOpsPlan } from "@/lib/blueprint-engine/plan/qa-ops-planner";
import { mergeDomainEntities } from "@/lib/blueprint-engine/plan/domain-entity-planner";
import { applyEntityFieldTemplates } from "@/lib/blueprint-engine/plan/entity-field-templates";
import { applyStackLock } from "@/lib/blueprint-engine/validate/stack-lock";
import { planAiToolPolicies } from "@/lib/blueprint-engine/validate/ai-action-policy";

type PlanningContext = Partial<
  Pick<
    ProjectContext,
    | "mainFeatures"
    | "adminFeatures"
    | "integrationNeeds"
    | "paymentProvider"
    | "shortDescription"
    | "longDescription"
  >
>;

function applyPolicyEngine(blueprint: ProjectBlueprint): ProjectBlueprint {
  if (!blueprint.classification.hasAiAgents) return blueprint;

  return {
    ...blueprint,
    policyEngine: blueprint.policyEngine ?? {
      enabled: true,
      components: [
        "authorization",
        "risk_evaluation",
        "autonomy_gates",
        "approval_routing",
        "idempotency_enforcement",
      ],
      evaluates: [
        "tool_risk_level",
        "tenant_scope",
        "human_approval_required",
        "idempotency_key",
        "external_write_safety",
      ],
    },
  };
}

/** Apply glossary, domain entities, field templates, integration/API plan, and stack lock. */
export function finalizeBlueprint(
  blueprint: ProjectBlueprint,
  ctx?: PlanningContext
): ProjectBlueprint {
  let result = applyGlossaryToBlueprint(blueprint);
  result = applyIntegrationPlan(result, ctx);
  result = applyQaAndOpsPlan(result, ctx);
  result = applyStackLock(result);
  result = planAiToolPolicies(result);
  if (ctx?.shortDescription || ctx?.longDescription || ctx?.mainFeatures) {
    result = mergeDomainEntities(result, ctx as ProjectContext);
  }
  result = applyEntityFieldTemplates(result);
  result = applyPolicyEngine(result);
  result = applyGlossaryToBlueprint(result);
  return result;
}
