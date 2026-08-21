import type { ProjectContext } from "@/lib/ai-prompts";
import type { ProjectBlueprint } from "@/lib/zod/blueprint-schemas";
import { applyGlossaryToBlueprint } from "@/lib/blueprint-engine/registry/glossary-builder";
import { applyIntegrationPlan } from "@/lib/blueprint-engine/plan/integration-planner";
import { applyQaAndOpsPlan } from "@/lib/blueprint-engine/plan/qa-ops-planner";
import { applyStackLock } from "@/lib/blueprint-engine/validate/stack-lock";
import { planAiToolPolicies } from "@/lib/blueprint-engine/validate/ai-action-policy";

type PlanningContext = Pick<
  ProjectContext,
  "mainFeatures" | "adminFeatures" | "integrationNeeds" | "paymentProvider"
>;

/** Apply glossary, integration/API plan, and stack lock to a blueprint. */
export function finalizeBlueprint(
  blueprint: ProjectBlueprint,
  ctx?: PlanningContext
): ProjectBlueprint {
  return planAiToolPolicies(
    applyStackLock(
      applyQaAndOpsPlan(applyIntegrationPlan(applyGlossaryToBlueprint(blueprint), ctx), ctx)
    )
  );
}
