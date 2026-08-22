import { db } from "@/db";
import { documents, featureDocuments } from "@/db/schema";
import { eq, and, lt } from "drizzle-orm";

// Netlify background functions allow up to 15 minutes. Reverting sooner kills
// in-flight jobs and makes the UI poll see "pending" while generation still runs.
export const STALE_GENERATING_MS = 18 * 60 * 1000;

export async function revertStaleBlueprintDocs(projectId: string): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_GENERATING_MS);
  await db
    .update(documents)
    .set({ status: "pending", updatedAt: new Date() })
    .where(
      and(
        eq(documents.projectId, projectId),
        eq(documents.status, "generating"),
        lt(documents.updatedAt, cutoff)
      )
    );
}

/** Docs with content but pending status were interrupted — surface as needs_revision. */
export async function repairInterruptedBlueprintDocs(projectId: string): Promise<void> {
  const rows = await db
    .select()
    .from(documents)
    .where(and(eq(documents.projectId, projectId), eq(documents.status, "pending")));

  for (const doc of rows) {
    if (!doc.content?.trim() && !(doc.wordCount && doc.wordCount > 0)) continue;
    await db
      .update(documents)
      .set({ status: "needs_revision", updatedAt: new Date() })
      .where(eq(documents.id, doc.id));
  }
}

export async function revertStaleFeatureDocs(featureRequestId: string): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_GENERATING_MS);
  await db
    .update(featureDocuments)
    .set({ status: "pending", updatedAt: new Date() })
    .where(
      and(
        eq(featureDocuments.featureRequestId, featureRequestId),
        eq(featureDocuments.status, "generating"),
        lt(featureDocuments.updatedAt, cutoff)
      )
    );
}
