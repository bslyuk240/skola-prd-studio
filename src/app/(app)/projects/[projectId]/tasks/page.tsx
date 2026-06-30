import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects, buildTasks, agentLogs, agentQuestions, agentConnections } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
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

  // Most recent "completed" report per task — drives the Agent Report panel.
  const completedLogs = await db
    .select()
    .from(agentLogs)
    .where(and(eq(agentLogs.projectId, projectId), eq(agentLogs.eventType, "completed")))
    .orderBy(desc(agentLogs.createdAt));
  const latestReportByTask: Record<string, typeof completedLogs[number]> = {};
  for (const log of completedLogs) {
    if (log.taskId && !latestReportByTask[log.taskId]) latestReportByTask[log.taskId] = log;
  }

  const questions = await db.select().from(agentQuestions).where(eq(agentQuestions.projectId, projectId));
  const questionsByTask: Record<string, typeof questions> = {};
  for (const q of questions) {
    if (!questionsByTask[q.taskId]) questionsByTask[q.taskId] = [];
    questionsByTask[q.taskId].push(q);
  }

  const connections = await db
    .select({ id: agentConnections.id, connectionName: agentConnections.connectionName })
    .from(agentConnections)
    .where(eq(agentConnections.projectId, projectId));
  const connectionNameById = Object.fromEntries(connections.map((c) => [c.id, c.connectionName]));

  return (
    <TasksBoardClient
      project={project}
      tasks={tasks}
      reportsByTask={latestReportByTask}
      questionsByTask={questionsByTask}
      connectionNameById={connectionNameById}
    />
  );
}
