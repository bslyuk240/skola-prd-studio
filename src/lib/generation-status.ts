import { db } from "@/db";
import { documents, featureDocuments } from "@/db/schema";
import { eq, and, lt } from "drizzle-orm";

// A background generation function can die without reaching its own catch
// block (killed by the platform's execution limit, an unhandled hang on the
// AI call, etc.), leaving a document stuck at "generating" forever — the UI
// disables both per-doc and bulk regeneration for anything in that state, so
// without this there is no self-service way to retry. Anything still
// "generating" after this long is treated as failed and unlocked for retry.
export const STALE_GENERATING_MS = 5 * 60 * 1000;

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
