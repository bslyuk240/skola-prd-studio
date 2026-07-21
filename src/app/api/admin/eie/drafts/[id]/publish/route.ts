import { NextRequest } from "next/server";
import { db } from "@/db";
import {
  eieConceptRelationships,
  eiePublishedKnowledge,
  eieSynthesisDrafts,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, isAuthFailure } from "@/lib/eie/auth";
import { eieError, eieOk, eieValidationError } from "@/lib/eie/api-response";
import { publishDraftSchema } from "@/lib/zod/eie-schemas";
import {
  buildEmbeddingInput,
  generateEmbedding,
} from "@/lib/eie/embeddings";
import { ensureUniqueSlug, slugifyConceptName } from "@/lib/eie/mappers";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin();
  if (isAuthFailure(auth)) return auth;

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const parsed = publishDraftSchema.safeParse(body);
  if (!parsed.success) {
    return eieValidationError(parsed.error.issues);
  }

  const [draft] = await db
    .select()
    .from(eieSynthesisDrafts)
    .where(eq(eieSynthesisDrafts.id, id))
    .limit(1);

  if (!draft) {
    return eieError("NOT_FOUND", "Draft not found", 404);
  }

  if (draft.status === "rejected") {
    return eieError("MUTATION_VIOLATION", "Rejected drafts cannot be published", 400);
  }

  const baseSlug = parsed.data.slug || slugifyConceptName(draft.conceptName);
  const slug = await ensureUniqueSlug(baseSlug, async (candidate) => {
    const [existing] = await db
      .select({ id: eiePublishedKnowledge.id })
      .from(eiePublishedKnowledge)
      .where(eq(eiePublishedKnowledge.slug, candidate))
      .limit(1);
    return Boolean(existing);
  });

  let embedding: number[] | null = null;
  try {
    embedding = await generateEmbedding(
      buildEmbeddingInput({
        conceptName: draft.conceptName,
        category: draft.category,
        summary: draft.summary,
        practicalExplanation: draft.practicalExplanation,
        tags: draft.tags,
      })
    );
  } catch (error) {
    console.error("[eie] embedding generation failed:", error);
  }

  const [published] = await db
    .insert(eiePublishedKnowledge)
    .values({
      synthesisDraftId: draft.id,
      slug,
      conceptName: draft.conceptName,
      category: draft.category,
      tags: draft.tags,
      summary: draft.summary,
      practicalExplanation: draft.practicalExplanation,
      bestPractices: draft.bestPractices,
      tradeOffs: draft.tradeOffs,
      alternativeApproaches: draft.alternativeApproaches,
      securityConsiderations: draft.securityConsiderations,
      commonMistakes: draft.commonMistakes,
      implementationRecommendations: draft.implementationRecommendations,
      references: draft.references,
      embedding,
    })
    .returning();

  if (parsed.data.relatedKnowledgeIds?.length) {
    await db.insert(eieConceptRelationships).values(
      parsed.data.relatedKnowledgeIds.map((targetId) => ({
        sourceKnowledgeId: published.id,
        targetKnowledgeId: targetId,
        relationshipType: parsed.data.relationshipType,
      }))
    );
  }

  await db
    .update(eieSynthesisDrafts)
    .set({
      status: "approved",
      reviewedBy: auth.userId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(eieSynthesisDrafts.id, id));

  return eieOk({ draftId: id, published });
}
