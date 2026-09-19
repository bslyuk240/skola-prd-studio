import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, documents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import type { ProjectContext } from "@/lib/ai-prompts";
import {
  getProjectBlueprint,
  saveProjectBlueprint,
} from "@/lib/blueprint-engine/project-blueprint-service";
import {
  applyArchitectureResolution,
  approveBlueprintModel,
  isBlueprintModelApproved,
  stackPreferencesFromBlueprint,
  wizardStackFromBlueprint,
} from "@/lib/blueprint-engine/apply-architecture-resolution";
import { assumptionEntrySchema } from "@/lib/zod/blueprint-schemas";
import { queuePendingDocuments } from "@/lib/mcp-studio/document-orchestration";

const patchSchema = z.object({
  stack: z
    .object({
      frontend: z.string().optional(),
      backend: z.string().optional(),
      database: z.string().optional(),
      auth: z.string().optional(),
      hosting: z.string().optional(),
      storage: z.string().optional(),
      payment: z.string().optional(),
    })
    .optional(),
  assumptions: z.array(assumptionEntrySchema).optional(),
});

function projectContextFromRow(project: typeof projects.$inferSelect): ProjectContext {
  const ctx = (project.wizardData ?? {}) as ProjectContext;
  ctx.appName = project.name;
  ctx.shortDescription = project.description ?? "";
  ctx.securityLevel = project.securityLevel ?? "standard";
  return ctx;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const projectDocs = await db
    .select()
    .from(documents)
    .where(eq(documents.projectId, projectId));

  const blueprint = await getProjectBlueprint(project);
  if (!blueprint) {
    return NextResponse.json({ error: "Blueprint model not built yet" }, { status: 404 });
  }

  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
    },
    blueprint,
    approved: isBlueprintModelApproved(blueprint, projectDocs),
    stackFields: wizardStackFromBlueprint(blueprint),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const projectDocs = await db
    .select()
    .from(documents)
    .where(eq(documents.projectId, projectId));

  const blueprint = await getProjectBlueprint(project);
  if (!blueprint) {
    return NextResponse.json({ error: "Blueprint model not built yet" }, { status: 404 });
  }

  if (isBlueprintModelApproved(blueprint, projectDocs)) {
    return NextResponse.json({ error: "Architecture model is already approved" }, { status: 409 });
  }

  const ctx = projectContextFromRow(project);
  const updatedBlueprint = applyArchitectureResolution(
    blueprint,
    {
      stack: parsed.data.stack,
      assumptions: parsed.data.assumptions,
    },
    ctx
  );

  const wizardStack = wizardStackFromBlueprint(updatedBlueprint);
  const wizardData = {
    ...(project.wizardData as Record<string, unknown>),
    ...wizardStack,
  };

  await saveProjectBlueprint(projectId, updatedBlueprint);
  await db
    .update(projects)
    .set({
      stackPreferences: stackPreferencesFromBlueprint(updatedBlueprint),
      wizardData,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId));

  return NextResponse.json({
    success: true,
    blueprint: updatedBlueprint,
    stackFields: wizardStack,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let blueprint = await getProjectBlueprint(project);
  if (!blueprint) {
    return NextResponse.json({ error: "Blueprint model not built yet" }, { status: 404 });
  }

  const projectDocs = await db
    .select()
    .from(documents)
    .where(eq(documents.projectId, projectId));

  if (isBlueprintModelApproved(blueprint, projectDocs)) {
    return NextResponse.json({ success: true, alreadyApproved: true });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (parsed.success && (parsed.data.stack || parsed.data.assumptions)) {
    const ctx = projectContextFromRow(project);
    blueprint = applyArchitectureResolution(
      blueprint,
      {
        stack: parsed.data.stack,
        assumptions: parsed.data.assumptions,
      },
      ctx
    );
  }

  const approvedBlueprint = approveBlueprintModel(blueprint);
  await saveProjectBlueprint(projectId, approvedBlueprint);

  await db
    .update(projects)
    .set({
      status: "generating",
      stackPreferences: stackPreferencesFromBlueprint(approvedBlueprint),
      wizardData: {
        ...(project.wizardData as Record<string, unknown>),
        ...wizardStackFromBlueprint(approvedBlueprint),
      },
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId));

  const siteUrl =
    process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? req.nextUrl.origin;

  const { queued, dispatchFailures } = await queuePendingDocuments(projectId, userId, siteUrl);

  return NextResponse.json({
    success: true,
    approvedAt: approvedBlueprint.metadata.modelApprovedAt,
    generationQueued: queued,
    dispatchFailures,
  });
}
