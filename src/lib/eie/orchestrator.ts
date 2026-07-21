import { db } from "@/db";
import {
  eieKnowledgeSources,
  eieSynthesisDrafts,
  type EieKnowledgeSource,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { extractText } from "@/lib/eie/parsers";
import { extractConceptSeeds } from "@/lib/eie/extraction/concept-seeder";
import { enrichConceptFromAuthoritativeSources } from "@/lib/eie/enrichment";
import { synthesizeGroundedConcept } from "@/lib/eie/synthesis/grounded-synthesizer";
import { synthesisToDraftInsert } from "@/lib/eie/mappers";
import { dispatchSourceProcessing } from "@/lib/eie/queue";
import { setSourceProcessingStage } from "@/lib/eie/processing-stage-store";
import type { DraftEnrichmentMetadata } from "@/lib/eie/types/enrichment";
import { EieCreditAccumulator } from "@/lib/eie/ai-credits";

export async function prepareSourceForProcessing(sourceId: string): Promise<void> {
  await db
    .delete(eieSynthesisDrafts)
    .where(eq(eieSynthesisDrafts.sourceId, sourceId));

  await db
    .update(eieKnowledgeSources)
    .set({
      status: "pending",
      errorMessage: null,
      aiCreditsUsed: 0,
      updatedAt: new Date(),
    })
    .where(eq(eieKnowledgeSources.id, sourceId));

  await setSourceProcessingStage(sourceId, "queued");
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

  await setSourceProcessingStage(sourceId, "extracting_text");

  try {
    const credits = new EieCreditAccumulator();
    const rawText = await extractText(source as EieKnowledgeSource, credits);

    await db
      .update(eieKnowledgeSources)
      .set({ rawContent: rawText, updatedAt: new Date() })
      .where(eq(eieKnowledgeSources.id, sourceId));

    await setSourceProcessingStage(sourceId, "identifying_concepts");

    const existingDrafts = await db
      .select({ conceptName: eieSynthesisDrafts.conceptName })
      .from(eieSynthesisDrafts);

    const seeds = await extractConceptSeeds(
      rawText,
      existingDrafts.map((d) => d.conceptName),
      credits
    );

    if (seeds.length === 0) {
      throw new Error("No concepts identified from source");
    }

    await setSourceProcessingStage(sourceId, "enriching_sources");

    const draftPayloads = [];
    for (const seed of seeds) {
      const enrichment = await enrichConceptFromAuthoritativeSources(seed, credits);

      await setSourceProcessingStage(sourceId, "synthesizing_concepts");

      const concept = await synthesizeGroundedConcept(seed, enrichment, rawText, credits);
      const metadata: DraftEnrichmentMetadata = {
        sourceContext: seed.sourceContext,
        enrichmentSources: enrichment.sources,
        enrichmentProvider: enrichment.provider,
        ...(enrichment.warning ? { enrichmentWarning: enrichment.warning } : {}),
      };

      draftPayloads.push({
        ...synthesisToDraftInsert(concept, sourceId, metadata),
        status: "draft" as const,
      });
    }

    await setSourceProcessingStage(sourceId, "saving_drafts");

    await db.insert(eieSynthesisDrafts).values(draftPayloads);

    await db
      .update(eieKnowledgeSources)
      .set({
        status: "success",
        aiCreditsUsed: credits.getTotal(),
        updatedAt: new Date(),
      })
      .where(eq(eieKnowledgeSources.id, sourceId));

    await setSourceProcessingStage(sourceId, "complete");
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
