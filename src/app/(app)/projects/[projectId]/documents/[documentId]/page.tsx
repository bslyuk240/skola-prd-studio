import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects, documents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { DocumentViewer } from "@/components/documents/document-viewer";
import { getDocumentRetrievals } from "@/lib/eie/retrievals";

interface Props {
  params: Promise<{ projectId: string; documentId: string }>;
}

export default async function DocumentPage({ params }: Props) {
  const { projectId, documentId } = await params;
  const { userId } = await auth();
  if (!userId) return null;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  if (!project) notFound();

  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.projectId, projectId)))
    .limit(1);
  if (!doc) notFound();

  const eieRetrievals = await getDocumentRetrievals(projectId, documentId);

  return (
    <DocumentViewer project={project} document={doc} eieRetrievals={eieRetrievals} />
  );
}
