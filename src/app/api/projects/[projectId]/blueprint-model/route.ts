import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import {
  ensureProjectBlueprintById,
  getProjectBlueprint,
  saveProjectBlueprint,
} from "@/lib/blueprint-engine/project-blueprint-service";
import { runBlueprintValidation } from "@/lib/blueprint-engine/validate/readiness";

const enrichSchema = z.object({
  enrich: z.boolean().default(true),
});

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

  const blueprint = await getProjectBlueprint(project);
  if (!blueprint) {
    return NextResponse.json({ error: "Blueprint model not built yet" }, { status: 404 });
  }

  const { issues, breakdown } = runBlueprintValidation(blueprint);
  return NextResponse.json({ blueprint, issues, breakdown });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = enrichSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    const blueprint = await ensureProjectBlueprintById(projectId, userId, {
      enrichWithLlm: parsed.data.enrich,
    });

    const { issues, breakdown } = runBlueprintValidation(blueprint);
    await saveProjectBlueprint(projectId, blueprint, breakdown);

    return NextResponse.json({
      success: true,
      blueprint,
      issues,
      breakdown,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Blueprint extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
