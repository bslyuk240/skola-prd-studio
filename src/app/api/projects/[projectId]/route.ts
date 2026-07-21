import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { mergeProjectWizardData } from "@/lib/eie/project-settings";

const patchSchema = z.object({
  enableEieCrossReferencing: z.boolean(),
});

interface Params {
  params: Promise<{ projectId: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const wizardData = mergeProjectWizardData(project.wizardData, parsed.data);

  const [updated] = await db
    .update(projects)
    .set({ wizardData, updatedAt: new Date() })
    .where(eq(projects.id, projectId))
    .returning({ id: projects.id, wizardData: projects.wizardData });

  return NextResponse.json({ success: true, project: updated });
}
