import type { ProjectContext } from "@/lib/ai-prompts";
import type { ProjectBlueprint } from "@/lib/zod/blueprint-schemas";
import { planFunctionalRequirements } from "@/lib/blueprint-engine/plan/requirements-planner";
import { planQaTestCases } from "@/lib/blueprint-engine/plan/qa-planner";
import { planOperationsModel } from "@/lib/blueprint-engine/plan/operations-planner";

type PlanningContext = Pick<ProjectContext, "mainFeatures" | "adminFeatures">;

/** Populate requirements, test cases, and deployment/operations models. */
export function applyQaAndOpsPlan(
  blueprint: ProjectBlueprint,
  ctx?: PlanningContext
): ProjectBlueprint {
  const requirements = planFunctionalRequirements(blueprint, ctx);
  const withRequirements: ProjectBlueprint = {
    ...blueprint,
    requirements,
  };

  return {
    ...withRequirements,
    testing: planQaTestCases(withRequirements),
    deployment: planOperationsModel(withRequirements),
  };
}
