import { db } from "@/db";
import { featureDocuments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { triggerBackground } from "@/lib/trigger-background";
import { generateFeatureDocument, type FeatureDocumentType } from "@/lib/generate-feature-document";

export async function dispatchSingleFeatureDocumentGeneration(
  featureRequestId: string,
  documentType: FeatureDocumentType,
  userId: string,
  siteUrl: string
): Promise<
  | { status: "generating" }
  | { status: "generated"; wordCount: number }
  | { status: "error"; detail: string }
> {
  await db
    .update(featureDocuments)
    .set({ status: "generating", updatedAt: new Date() })
    .where(and(eq(featureDocuments.featureRequestId, featureRequestId), eq(featureDocuments.type, documentType)));

  const dispatched = await triggerBackground(
    `${siteUrl}/.netlify/functions/feature-generate-background`,
    { featureRequestId, documentType, userId }
  );
  if (dispatched) return { status: "generating" };

  try {
    const result = await generateFeatureDocument(featureRequestId, documentType, userId);
    return { status: "generated", wordCount: result.wordCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(featureDocuments)
      .set({ status: "pending", updatedAt: new Date() })
      .where(and(eq(featureDocuments.featureRequestId, featureRequestId), eq(featureDocuments.type, documentType)));
    return { status: "error", detail: message };
  }
}

export async function queueAllFeatureDocuments(
  featureRequestId: string,
  userId: string,
  siteUrl: string
): Promise<{ queued: number; documentTypes: string[] }> {
  const pendingDocs = await db
    .select()
    .from(featureDocuments)
    .where(and(eq(featureDocuments.featureRequestId, featureRequestId), eq(featureDocuments.status, "pending")));

  for (const doc of pendingDocs) {
    await db
      .update(featureDocuments)
      .set({ status: "generating", updatedAt: new Date() })
      .where(eq(featureDocuments.id, doc.id));
    await triggerBackground(`${siteUrl}/.netlify/functions/feature-generate-background`, {
      featureRequestId,
      documentType: doc.type,
      userId,
    });
  }

  return { queued: pendingDocs.length, documentTypes: pendingDocs.map((d) => d.type) };
}
