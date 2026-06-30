import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects, buildTasks, agentConnections, agentLogs, agentQuestions } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { AgentHandoffClient } from "@/components/agent/agent-handoff-client";

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function AgentPage({ params }: Props) {
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
  const connections = await db
    .select({
      id: agentConnections.id,
      agentType: agentConnections.agentType,
      connectionName: agentConnections.connectionName,
      status: agentConnections.status,
      createdAt: agentConnections.createdAt,
      revokedAt: agentConnections.revokedAt,
    })
    .from(agentConnections)
    .where(eq(agentConnections.projectId, projectId));

  const recentEvents = await db
    .select()
    .from(agentLogs)
    .where(eq(agentLogs.projectId, projectId))
    .orderBy(desc(agentLogs.createdAt))
    .limit(20);

  const pendingQuestions = await db
    .select()
    .from(agentQuestions)
    .where(and(eq(agentQuestions.projectId, projectId), eq(agentQuestions.status, "pending")));

  return (
    <AgentHandoffClient
      project={project}
      tasks={tasks}
      connections={connections}
      recentEvents={recentEvents}
      pendingQuestions={pendingQuestions}
    />
  );
}
