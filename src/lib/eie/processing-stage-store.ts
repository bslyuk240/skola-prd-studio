import { db } from "@/db";
import { eieKnowledgeSources } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { EieProcessingStage } from "@/lib/eie/processing-stages";

function readMetadataRecord(metadata: unknown): Record<string, unknown> {
  if (typeof metadata === "object" && metadata !== null && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

export async function setSourceProcessingStage(
  sourceId: string,
  stage: EieProcessingStage
): Promise<void> {
  const [source] = await db
    .select({ metadata: eieKnowledgeSources.metadata })
    .from(eieKnowledgeSources)
    .where(eq(eieKnowledgeSources.id, sourceId))
    .limit(1);

  if (!source) return;

  const metadata = {
    ...readMetadataRecord(source.metadata),
    processingStage: stage,
    processingUpdatedAt: new Date().toISOString(),
  };

  await db
    .update(eieKnowledgeSources)
    .set({ metadata, updatedAt: new Date() })
    .where(eq(eieKnowledgeSources.id, sourceId));
}
