import { db } from "@/db";
import {
  eieKnowledgeSources,
  eieSynthesisDrafts,
  type EieKnowledgeSource,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { extractText } from "@/lib/eie/parsers";
import { extractConceptsFromText } from "@/lib/eie/extraction/concept-extractor";
import { synthesisToDraftInsert } from "@/lib/eie/mappers";
import { dispatchSourceProcessing } from "@/lib/eie/queue";

export async function prepareSourceForProcessing(sourceId: string): Promise<void> {
  await db
    .delete(eieSynthesisDrafts)
    .where(eq(eieSynthesisDrafts.sourceId, sourceId));

  await db
    .update(eieKnowledgeSources)
    .set({
      status: "pending",
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(eieKnowledgeSources.id, sourceId));
}

export async function processSource(sourceId: string): Promise<void> {
  const [source] = await db
    .select()
    .from(eieKnowledgeSources)
    .where(eq(eieKnowledgeSources.id, sourceId))
    .limit(1);

  if (!source) {
    throw new Error("Source not found");
  }

  if (source.status === "processing") {
    throw new Error("Source is already being processed");
  }

  await db
    .update(eieKnowledgeSources)
    .set({ status: "processing", updatedAt: new Date(), errorMessage: null })
    .where(eq(eieKnowledgeSources.id, sourceId));

  try {
    const rawText = await extractText(source as EieKnowledgeSource);

    await db
      .update(eieKnowledgeSources)
      .set({ rawContent: rawText, updatedAt: new Date() })
      .where(eq(eieKnowledgeSources.id, sourceId));

    const existingDrafts = await db
      .select({ conceptName: eieSynthesisDrafts.conceptName })
      .from(eieSynthesisDrafts);

    const concepts = await extractConceptsFromText(
      rawText,
      existingDrafts.map((d) => d.conceptName)
    );

    if (concepts.length === 0) {
      throw new Error("No concepts extracted from source");
    }

    await db.insert(eieSynthesisDrafts).values(
      concepts.map((concept) => ({
        ...synthesisToDraftInsert(concept, sourceId),
        status: "draft" as const,
      }))
    );

    await db
      .update(eieKnowledgeSources)
      .set({ status: "success", updatedAt: new Date() })
      .where(eq(eieKnowledgeSources.id, sourceId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Processing failed";
    await db
      .update(eieKnowledgeSources)
      .set({
        status: "failed",
        errorMessage: message,
        updatedAt: new Date(),
      })
      .where(eq(eieKnowledgeSources.id, sourceId));
    throw error;
  }
}

/** Queue async processing — returns immediately without awaiting extraction. */
export async function queueSourceProcessing(
  sourceId: string
): Promise<{ mode: "qstash" | "inline" }> {
  return dispatchSourceProcessing(sourceId);
}
