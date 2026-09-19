import { db } from "@/db";
import { featureRequests, featureDocuments, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { buildFeatureBlueprint } from "@/lib/blueprint-engine/extract/build-feature-blueprint";
import { saveFeatureBlueprint, getLinkedProjectBlueprint } from "@/lib/blueprint-engine/feature-blueprint-service";
import type { z } from "zod";
import type { requestFeatureParams } from "@/lib/validators/mcp-studio";

const FEATURE_DOC_TYPES = [
  { type: "feature_prd" as const, title: "Feature Requirements Document" },
  { type: "impact_analysis" as const, title: "Impact Analysis" },
  { type: "schema_changes" as const, title: "Schema & API Changes" },
  { type: "api_changes" as const, title: "API Changes" },
  { type: "ui_changes" as const, title: "UI Change Plan" },
  { type: "security_checklist" as const, title: "Security Impact Checklist" },
  { type: "implementation_tasks" as const, title: "Implementation Tasks" },
  { type: "test_plan" as const, title: "Test Plan" },
  { type: "deployment_plan" as const, title: "Deployment & Rollback Plan" },
];

export type RequestFeatureOutcome =
  | { ok: true; requestId: string }
  | { ok: false; status: 404; error: string };

/** Mirrors POST /api/feature/request — shared so the app UI and the MCP connector stay in sync. */
export async function requestFeatureFromInput(
  userId: string,
  data: z.infer<typeof requestFeatureParams>
): Promise<RequestFeatureOutcome> {
  const { projectId, ...requestData } = data;

  if (projectId) {
    const [linkedProject] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);
    if (!linkedProject) return { ok: false, status: 404, error: "Linked project not found" };
  }

  const [request] = await db.insert(featureRequests).values({
    userId,
    projectId: projectId ?? null,
    ...requestData,
    status: "draft",
  }).returning();

  const linkedProjectBlueprint = await getLinkedProjectBlueprint(projectId ?? null, userId);
  const featureBlueprint = buildFeatureBlueprint(
    {
      linkedProjectId: projectId ?? null,
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
    },
    linkedProjectBlueprint
  );
  await saveFeatureBlueprint(request.id, featureBlueprint);

  await db.insert(featureDocuments).values(
    FEATURE_DOC_TYPES.map(({ type, title }) => ({
      featureRequestId: request.id,
      type,
      title,
      status: "pending" as const,
    }))
  );

  return { ok: true, requestId: request.id };
}
