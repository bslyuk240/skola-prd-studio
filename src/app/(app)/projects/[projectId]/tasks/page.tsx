import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects, buildTasks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { TasksBoardClient } from "@/components/tasks/tasks-board-client";

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function TasksPage({ params }: Props) {
  const { projectId } = await params;
  const { userId } = await auth();
  if (!userId) return null;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  if (!project) notFound();

  const tasks = await db.select().from(buildTasks).where(eq(buildTasks.projectId, projectId));

  return <TasksBoardClient project={project} tasks={tasks} />;
}
