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
