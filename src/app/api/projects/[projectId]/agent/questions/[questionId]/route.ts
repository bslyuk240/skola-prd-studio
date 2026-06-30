import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, agentQuestions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const schema = z.object({ answer: z.string().min(1) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ projectId: string; questionId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, questionId } = await params;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });

  await db
    .update(agentQuestions)
    .set({ answer: parsed.data.answer, status: "answered", answeredAt: new Date() })
    .where(and(eq(agentQuestions.id, questionId), eq(agentQuestions.projectId, projectId)));

  return NextResponse.json({ success: true });
}
