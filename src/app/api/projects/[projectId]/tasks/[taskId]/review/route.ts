import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, buildTasks, agentLogs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const schema = z.object({
  decision: z.enum(["approved", "reject_revision"]),
  reviewNotes: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string; taskId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, taskId } = await params;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const [task] = await db
    .select()
    .from(buildTasks)
    .where(and(eq(buildTasks.id, taskId), eq(buildTasks.projectId, projectId)))
    .limit(1);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });

  const { decision, reviewNotes } = parsed.data;
  const newStatus = decision === "approved" ? "done" : "in_progress";

  await db
    .update(buildTasks)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(buildTasks.id, taskId));

  await db.insert(agentLogs).values({
    projectId,
    taskId,
    agentSessionId: null,
    eventType: decision === "approved" ? "completed" : "needs_review",
    message: reviewNotes ?? (decision === "approved" ? "Human review: approved." : "Human review: sent back for revision."),
    status: newStatus,
  });

  return NextResponse.json({ status: "success", taskId, newStatus });
}
