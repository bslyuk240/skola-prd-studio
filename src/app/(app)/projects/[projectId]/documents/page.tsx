import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects, documents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { DocumentsClient } from "@/components/documents/documents-client";
import { revertStaleBlueprintDocs } from "@/lib/generation-status";

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function DocumentsPage({ params }: Props) {
  const { projectId } = await params;
  const { userId } = await auth();
  if (!userId) return null;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!project) notFound();

  await revertStaleBlueprintDocs(projectId);

  const docs = await db.select().from(documents).where(eq(documents.projectId, projectId));

  return <DocumentsClient project={project} documents={docs} />;
}
