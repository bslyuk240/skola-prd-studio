import type { FeatureBlueprint, FeatureScope, ProjectBlueprint } from "@/lib/zod/blueprint-schemas";

export type FeatureRequestInput = FeatureScope & {
  linkedProjectId?: string | null;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

function featureRequirementStatements(scope: FeatureScope): FeatureBlueprint["requirements"]["functional"] {
  const reqs: FeatureBlueprint["requirements"]["functional"] = [
    {
      id: "FR-FEAT-001",
      statement: `Deliver "${scope.name}" for ${scope.scopeLevel} scope: ${scope.description}`,
      priority: "must_have",
    },
  ];

  if (scope.affectsPermissions) {
    reqs.push({
      id: "FR-FEAT-002",
      statement: "Update RBAC and permission checks for affected roles without breaking existing access",
      priority: "must_have",
    });
  }
  if (scope.needsNewTables) {
    reqs.push({
      id: "FR-FEAT-003",
      statement: "Add new database tables with migrations, indexes, and foreign keys to existing canonical tables",
      priority: "must_have",
    });
  }
  if (scope.needsNotifications) {
    reqs.push({
      id: "FR-FEAT-004",
      statement: "Send notifications for key feature events with user preference respect",
      priority: "should_have",
    });
  }
  if (scope.affectsBilling) {
    reqs.push({
      id: "FR-FEAT-005",
      statement: "Enforce subscription or billing gates before enabling paid feature capabilities",
      priority: "must_have",
    });
  }

  return reqs;
}

function featureTestCases(
  requirements: FeatureBlueprint["requirements"]["functional"]
): FeatureBlueprint["testing"]["testCases"] {
  return requirements.map((req, index) => ({
    id: `TC-FEAT-${String(index + 1).padStart(2, "0")}`,
    requirementId: req.id,
    type: req.id.includes("003") ? ("integration" as const) : ("e2e" as const),
    priority: req.priority === "must_have" ? ("critical" as const) : ("high" as const),
    description: `Verify ${req.statement}`,
    automationCandidate: true,
  }));
}

function planDeltaApis(scope: FeatureScope, slug: string): FeatureBlueprint["deltaApis"] {
  const apis: FeatureBlueprint["deltaApis"] = [
    {
      id: `API-FEAT-${slug}-list`,
      method: "GET",
      path: `/api/features/${slug}`,
      purpose: `List ${scope.name} resources for authorized roles`,
      authRequired: true,
      idempotent: true,
      delivery: "sync",
    },
    {
      id: `API-FEAT-${slug}-create`,
      method: "POST",
      path: `/api/features/${slug}`,
      purpose: `Create ${scope.name} resource`,
      authRequired: true,
      idempotent: false,
      delivery: "sync",
    },
  ];

  if (scope.affectsPermissions) {
    apis.push({
      id: `API-FEAT-${slug}-permissions`,
      method: "PATCH",
      path: `/api/features/${slug}/permissions`,
      purpose: "Update role permissions introduced by this feature",
      authRequired: true,
      idempotent: true,
      delivery: "sync",
    });
  }

  return apis;
}

function planNewEntity(scope: FeatureScope, slug: string): FeatureBlueprint["impactedEntities"] {
  if (!scope.needsNewTables) return {};

  const entityId = `${slug}_records`;
  return {
    [entityId]: {
      id: entityId,
      tableName: entityId,
      description: `Stores ${scope.name} data`,
      fields: [
        { name: "id", type: "uuid", constraints: "PRIMARY KEY", description: "Primary key" },
        { name: "created_at", type: "timestamptz", constraints: "NOT NULL", description: "Created timestamp" },
        { name: "updated_at", type: "timestamptz", constraints: "NOT NULL", description: "Updated timestamp" },
      ],
      complete: false,
    },
  };
}

function deploymentFromProject(
  projectBlueprint: ProjectBlueprint | null,
  scope: FeatureScope
): FeatureBlueprint["deployment"] {
  const base = projectBlueprint?.deployment;
  const stages = base?.ciPipeline?.stages ?? base?.ciSteps ?? ["lint", "test", "build", "deploy"];

  return {
    environments: base?.environments ?? ["development", "production"],
    ciSteps: stages,
    ciPipeline: base?.ciPipeline ?? {
      trigger: "push to main",
      stages,
    },
    rollbackSteps: [
      "Disable feature flag for " + scope.name,
      "Revert database migration if schema changes were applied",
      "Redeploy previous application release",
      "Verify canonical entities and APIs match pre-release state",
    ],
  };
}

/** Build canonical feature model from wizard input and optional linked project blueprint. */
export function buildFeatureBlueprint(
  input: FeatureRequestInput,
  linkedProjectBlueprint: ProjectBlueprint | null = null
): FeatureBlueprint {
  const slug = slugify(input.name);
  const requirements = featureRequirementStatements(input);
  const linkedEntities = linkedProjectBlueprint?.entities ?? {};

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    linkedProjectId: input.linkedProjectId ?? null,
    feature: {
      name: input.name,
      description: input.description,
      affectedRoles: input.affectedRoles,
      affectsPermissions: input.affectsPermissions ?? false,
      needsNewTables: input.needsNewTables ?? false,
      needsNotifications: input.needsNotifications ?? false,
      affectsDashboard: input.affectsDashboard ?? false,
      mobileRequired: input.mobileRequired ?? false,
      affectsBilling: input.affectsBilling ?? false,
      scopeLevel: input.scopeLevel ?? "mvp",
      additionalContext: input.additionalContext,
    },
    linkedEntities,
    impactedEntities: planNewEntity(input, slug),
    deltaApis: planDeltaApis(input, slug),
    requirements: { functional: requirements },
    testing: { testCases: featureTestCases(requirements) },
    deployment: deploymentFromProject(linkedProjectBlueprint, input),
    glossary: linkedProjectBlueprint?.glossary ?? [],
  };
}

export function canonicalTableNames(
  featureBlueprint: FeatureBlueprint,
  linkedProjectBlueprint: ProjectBlueprint | null
): string[] {
  const tables = new Set<string>();

  for (const entity of Object.values(linkedProjectBlueprint?.entities ?? featureBlueprint.linkedEntities)) {
    tables.add(entity.tableName);
  }
  for (const entity of Object.values(featureBlueprint.impactedEntities)) {
    tables.add(entity.tableName);
  }

  return [...tables].sort();
}
