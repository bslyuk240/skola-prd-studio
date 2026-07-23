import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { featureRequests, featureDocuments, featureTasks, repoConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { FeaturePlanClient } from "@/components/feature/feature-plan-client";
import { revertStaleFeatureDocs } from "@/lib/generation-status";

interface Props {
  params: Promise<{ requestId: string }>;
}

export default async function FeaturePlanPage({ params }: Props) {
  const { requestId } = await params;
  const { userId } = await auth();
  if (!userId) return null;

  const [request] = await db
    .select()
    .from(featureRequests)
    .where(and(eq(featureRequests.id, requestId), eq(featureRequests.userId, userId)))
    .limit(1);
  if (!request) notFound();

  await revertStaleFeatureDocs(requestId);

  const [docs, tasks] = await Promise.all([
    db.select().from(featureDocuments).where(eq(featureDocuments.featureRequestId, requestId)),
    db.select().from(featureTasks).where(eq(featureTasks.featureRequestId, requestId)),
  ]);

  let repoConn = null;
  if (request.repoConnectionId) {
    const [conn] = await db.select().from(repoConnections).where(eq(repoConnections.id, request.repoConnectionId)).limit(1);
    repoConn = conn;
  }

  return <FeaturePlanClient request={request} documents={docs} tasks={tasks} repoConnection={repoConn} />;
}
