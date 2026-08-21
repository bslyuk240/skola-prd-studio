import { db } from "@/db";
import { featureRequests, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  featureBlueprintSchema,
  type FeatureBlueprint,
  type ProjectBlueprint,
} from "@/lib/zod/blueprint-schemas";
import {
  buildFeatureBlueprint,
  type FeatureRequestInput,
} from "@/lib/blueprint-engine/extract/build-feature-blueprint";
import { getProjectBlueprint } from "@/lib/blueprint-engine/project-blueprint-service";

function parseStoredFeatureBlueprint(value: unknown): FeatureBlueprint | null {
  const parsed = featureBlueprintSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function inputFromRequest(
  request: typeof featureRequests.$inferSelect
): FeatureRequestInput {
  return {
    linkedProjectId: request.projectId,
    name: request.featureName,
    description: request.featureDescription,
    affectedRoles: request.affectedRoles ?? undefined,
    affectsPermissions: request.affectsPermissions ?? false,
    needsNewTables: request.needsNewTables ?? false,
    needsNotifications: request.needsNotifications ?? false,
    affectsDashboard: request.affectsDashboard ?? false,
    mobileRequired: request.mobileRequired ?? false,
    affectsBilling: request.affectsBilling ?? false,
    scopeLevel: (request.scopeLevel as "mvp" | "full") ?? "mvp",
    additionalContext: request.additionalContext ?? undefined,
  };
}

export async function getLinkedProjectBlueprint(
  projectId: string | null | undefined,
  userId: string
): Promise<ProjectBlueprint | null> {
  if (!projectId) return null;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!project) return null;
  return getProjectBlueprint(project);
}

export async function saveFeatureBlueprint(
  featureRequestId: string,
  blueprint: FeatureBlueprint
): Promise<void> {
  const validated = featureBlueprintSchema.parse(blueprint);
  await db
    .update(featureRequests)
    .set({
      featureBlueprintModel: validated,
      updatedAt: new Date(),
    })
    .where(eq(featureRequests.id, featureRequestId));
}

export async function ensureFeatureBlueprint(
  request: typeof featureRequests.$inferSelect,
  userId: string
): Promise<{ featureBlueprint: FeatureBlueprint; linkedProjectBlueprint: ProjectBlueprint | null }> {
  const existing = parseStoredFeatureBlueprint(request.featureBlueprintModel);
  const linkedProjectBlueprint = await getLinkedProjectBlueprint(request.projectId, userId);

  if (existing && existing.linkedProjectId === (request.projectId ?? null)) {
    return { featureBlueprint: existing, linkedProjectBlueprint };
  }

  const featureBlueprint = buildFeatureBlueprint(inputFromRequest(request), linkedProjectBlueprint);
  await saveFeatureBlueprint(request.id, featureBlueprint);
  return { featureBlueprint, linkedProjectBlueprint };
}
