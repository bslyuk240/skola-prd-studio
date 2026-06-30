import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, buildTasks, documents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { buildTaskPacket } from "@/lib/task-packet";

async function loadContext(projectId: string, taskId: string, userId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  if (!project) return null;

  const [task] = await db
    .select()
    .from(buildTasks)
    .where(and(eq(buildTasks.id, taskId), eq(buildTasks.projectId, projectId)))
    .limit(1);
  if (!task) return null;

  const docs = await db.select().from(documents).where(eq(documents.projectId, projectId));

  return { project, task, docs };
}

// Preview the Task Packet — no side effects.
export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string; taskId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, taskId } = await params;
  const ctx = await loadContext(projectId, taskId, userId);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(buildTaskPacket(ctx.project, ctx.task, ctx.docs));
}

// Approve the task for agent handoff — sets isApprovedForAgent and returns the packet.
export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string; taskId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, taskId } = await params;
  const ctx = await loadContext(projectId, taskId, userId);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db
    .update(buildTasks)
    .set({ isApprovedForAgent: true, status: ctx.task.status === "backlog" ? "ready" : ctx.task.status, updatedAt: new Date() })
    .where(eq(buildTasks.id, taskId));

  return NextResponse.json(buildTaskPacket(ctx.project, ctx.task, ctx.docs));
}
