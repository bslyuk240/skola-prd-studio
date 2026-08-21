import type { ProjectBlueprint } from "@/lib/zod/blueprint-schemas";
import type { z } from "zod";
import type {
  backupRecoveryModelSchema,
  environmentModelSchema,
} from "@/lib/zod/blueprint-schemas";
import { resolveServiceKey } from "@/lib/blueprint-engine/registry/capabilities";

type EnvironmentModel = z.infer<typeof environmentModelSchema>;
type BackupRecoveryModel = z.infer<typeof backupRecoveryModelSchema>;

function environmentsForStage(
  stage: ProjectBlueprint["product"]["stage"]
): EnvironmentModel[] {
  switch (stage) {
    case "prototype":
      return [
        { name: "development", purpose: "Local and preview iteration", dataPolicy: "synthetic" },
        { name: "production", purpose: "Early user validation", dataPolicy: "masked" },
      ];
    case "mvp":
      return [
        { name: "development", purpose: "Feature development and PR previews", dataPolicy: "synthetic" },
        { name: "staging", purpose: "Release candidate verification", dataPolicy: "masked" },
        { name: "production", purpose: "Live customer traffic", dataPolicy: "production_like" },
      ];
    case "production":
    case "enterprise":
      return [
        { name: "development", purpose: "Engineering sandbox", dataPolicy: "synthetic" },
        { name: "staging", purpose: "Pre-production integration testing", dataPolicy: "masked" },
        { name: "production", purpose: "Live traffic", dataPolicy: "production_like" },
        {
          name: "disaster_recovery",
          purpose: "Failover region for stateful services",
          dataPolicy: "production_like",
        },
      ];
    default:
      return [
        { name: "development", purpose: "Development", dataPolicy: "synthetic" },
        { name: "production", purpose: "Production", dataPolicy: "masked" },
      ];
  }
}

function ciStepsForBlueprint(blueprint: ProjectBlueprint): string[] {
  const steps = new Set<string>(["lint", "typecheck", "unit_tests", "build"]);

  if (blueprint.stack.database) steps.add("integration_tests");
  if (blueprint.integrations.length > 0) steps.add("contract_tests");
  if (blueprint.classification.hasAiAgents) steps.add("agent_policy_tests");
  if (blueprint.classification.hasFileUpload) steps.add("upload_validation_tests");

  const security = blueprint.product.securityRequirement;
  if (security === "high" || security === "enterprise" || security === "regulated") {
    steps.add("security_scan");
    steps.add("dependency_audit");
  }
  if (security === "enterprise" || security === "regulated") {
    steps.add("penetration_smoke_tests");
  }

  return [...steps];
}

function ciPipelineForBlueprint(blueprint: ProjectBlueprint): {
  trigger: string;
  stages: string[];
} {
  const stages = ["install_dependencies", ...ciStepsForBlueprint(blueprint), "deploy_preview"];
  if (blueprint.product.stage !== "prototype") {
    stages.push("deploy_staging");
  }
  stages.push("deploy_production");

  return {
    trigger: blueprint.stack.hosting ? "push_to_main_and_pull_request" : "push_to_main",
    stages,
  };
}

function backupRecoveryForBlueprint(blueprint: ProjectBlueprint): BackupRecoveryModel[] {
  const models: BackupRecoveryModel[] = [];

  if (blueprint.stack.database) {
    const key = resolveServiceKey(blueprint.stack.database);
    models.push({
      component: blueprint.stack.database,
      strategy:
        key === "neon"
          ? "Neon point-in-time recovery with daily logical export"
          : "Automated daily backups with tested restore procedure",
      rpoMinutes: key === "neon" ? 15 : 1440,
      rtoMinutes: key === "neon" ? 60 : 240,
    });
  }

  if (blueprint.stack.storage) {
    models.push({
      component: blueprint.stack.storage,
      strategy: "Object versioning with lifecycle retention policy",
      rpoMinutes: 60,
      rtoMinutes: 120,
    });
  }

  for (const integration of blueprint.integrations) {
    if (/stripe|payment|pay/i.test(integration.name)) {
      models.push({
        component: integration.name,
        strategy: "Reconcile financial state from webhook event log and provider dashboard",
        rpoMinutes: 5,
        rtoMinutes: 30,
      });
    }
  }

  if (blueprint.classification.hasAiAgents) {
    models.push({
      component: "tool_executions audit log",
      strategy: "Append-only audit storage with export to cold archive",
      rpoMinutes: 15,
      rtoMinutes: 60,
    });
  }

  return models;
}

/** Derive environments, CI/CD, and backup/recovery models from stack and stage. */
export function planOperationsModel(blueprint: ProjectBlueprint): ProjectBlueprint["deployment"] {
  const environmentModel = environmentsForStage(blueprint.product.stage);
  const ciSteps = ciStepsForBlueprint(blueprint);

  return {
    ...blueprint.deployment,
    environments: environmentModel.map((env) => env.name),
    provider: blueprint.deployment.provider ?? blueprint.stack.hosting,
    ciSteps,
    environmentModel,
    ciPipeline: ciPipelineForBlueprint(blueprint),
    backupRecovery: backupRecoveryForBlueprint(blueprint),
  };
}

export { environmentsForStage, ciStepsForBlueprint, backupRecoveryForBlueprint };
