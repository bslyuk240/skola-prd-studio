import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects, documents, buildTasks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ExportClient } from "@/components/export/export-client";
import { getProjectBlueprint } from "@/lib/blueprint-engine/project-blueprint-service";
import { buildIntegrityReport } from "@/lib/blueprint-engine/integrity-report";

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function ExportPage({ params }: Props) {
  const { projectId } = await params;
  const { userId } = await auth();
  if (!userId) return null;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  if (!project) notFound();

  const docs = await db.select().from(documents).where(eq(documents.projectId, projectId));
  const tasks = await db.select().from(buildTasks).where(eq(buildTasks.projectId, projectId));

  const readyDocs = docs.filter((d) => d.status === "ready" || d.status === "approved");
  const doneTasks = tasks.filter((t) => t.status === "done");

  const blueprint = await getProjectBlueprint(project);
  const snapshots = docs
    .filter((doc) => doc.content)
    .map((doc) => ({ type: doc.type, content: doc.content! }));
  const integrityReport = buildIntegrityReport(blueprint, snapshots);

  return (
    <ExportClient
      project={project}
      totalDocs={docs.length}
      readyDocs={readyDocs.length}
      totalTasks={tasks.length}
      doneTasks={doneTasks.length}
      integrityReport={integrityReport}
    />
  );
}
