import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { featureRequests, featureDocuments, projects } from "@/db/schema";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import {
  buildFeatureBlueprint,
} from "@/lib/blueprint-engine/extract/build-feature-blueprint";
import { saveFeatureBlueprint, getLinkedProjectBlueprint } from "@/lib/blueprint-engine/feature-blueprint-service";

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

const schema = z.object({
  repoConnectionId: z.string().optional(),
  projectId: z.string().uuid().optional(),
  featureName: z.string().min(1),
  featureDescription: z.string().min(1),
  affectedRoles: z.string().optional(),
  affectsPermissions: z.boolean().optional(),
  needsNewTables: z.boolean().optional(),
  needsNotifications: z.boolean().optional(),
  affectsDashboard: z.boolean().optional(),
  mobileRequired: z.boolean().optional(),
  affectsBilling: z.boolean().optional(),
  scopeLevel: z.enum(["mvp", "full"]).optional(),
  additionalContext: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { projectId, ...requestData } = parsed.data;

  if (projectId) {
    const [linkedProject] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);
    if (!linkedProject) {
      return NextResponse.json({ error: "Linked project not found" }, { status: 404 });
    }
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

  // Create placeholder feature documents
  await db.insert(featureDocuments).values(
    FEATURE_DOC_TYPES.map(({ type, title }) => ({
      featureRequestId: request.id,
      type,
      title,
      status: "pending" as const,
    }))
  );

  return NextResponse.json({ requestId: request.id });
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requests = await db
    .select()
    .from(featureRequests)
    .where(eq(featureRequests.userId, userId))
    .orderBy(desc(featureRequests.createdAt));

  return NextResponse.json(requests);
}
