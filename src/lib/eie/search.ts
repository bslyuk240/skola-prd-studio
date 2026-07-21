import { db } from "@/db";
import {
  eieConceptRelationships,
  eiePublishedKnowledge,
} from "@/db/schema";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { LibrarySearchInput } from "@/lib/zod/eie-schemas";
import { generateEmbedding } from "@/lib/eie/embeddings";
import type { PublicKnowledgeConcept } from "@/lib/eie/public-serializer";
import { toPublicConcept } from "@/lib/eie/public-serializer";

export type PublishedKnowledgePublic = Omit<
  typeof eiePublishedKnowledge.$inferSelect,
  "embedding"
>;

function stripEmbedding(
  row: typeof eiePublishedKnowledge.$inferSelect
): PublishedKnowledgePublic {
  const { embedding: _embedding, ...rest } = row;
  return rest;
}

export async function searchPublished(
  filters: LibrarySearchInput
): Promise<{ rows: PublishedKnowledgePublic[]; total: number }> {
  const { query, category, tags, page, limit } = filters;
  const offset = (page - 1) * limit;

  const conditions = [];

  if (category) {
    conditions.push(eq(eiePublishedKnowledge.category, category));
  }

  if (tags?.length) {
    conditions.push(
      sql`${eiePublishedKnowledge.tags} && ARRAY[${sql.join(
        tags.map((tag) => sql`${tag}`),
        sql`, `
      )}]::text[]`
    );
  }

  if (query?.trim()) {
    const pattern = `%${query.trim()}%`;
    conditions.push(
      or(
        ilike(eiePublishedKnowledge.conceptName, pattern),
        ilike(eiePublishedKnowledge.summary, pattern),
        ilike(eiePublishedKnowledge.category, pattern)
      )
    );
  }

  const whereClause = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(eiePublishedKnowledge)
    .where(whereClause)
    .orderBy(desc(eiePublishedKnowledge.updatedAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eiePublishedKnowledge)
    .where(whereClause);

  return { rows: rows.map(stripEmbedding), total: count ?? 0 };
}

export async function getPublishedBySlug(
  slug: string
): Promise<PublishedKnowledgePublic | null> {
  const [row] = await db
    .select()
    .from(eiePublishedKnowledge)
    .where(eq(eiePublishedKnowledge.slug, slug))
    .limit(1);

  return row ? stripEmbedding(row) : null;
}

export async function incrementPublishedViews(slug: string): Promise<void> {
  await db
    .update(eiePublishedKnowledge)
    .set({
      viewsCount: sql`${eiePublishedKnowledge.viewsCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(eiePublishedKnowledge.slug, slug));
}

export async function getRelatedConcepts(
  publishedId: string
): Promise<PublicKnowledgeConcept[]> {
  const relationships = await db
    .select()
    .from(eieConceptRelationships)
    .where(
      or(
        eq(eieConceptRelationships.sourceKnowledgeId, publishedId),
        eq(eieConceptRelationships.targetKnowledgeId, publishedId)
      )
    );

  const relatedIds = relationships.map((rel) =>
    rel.sourceKnowledgeId === publishedId
      ? rel.targetKnowledgeId
      : rel.sourceKnowledgeId
  );

  if (relatedIds.length === 0) return [];

  const rows = await db
    .select()
    .from(eiePublishedKnowledge)
    .where(
      sql`${eiePublishedKnowledge.id} IN (${sql.join(
        relatedIds.map((id) => sql`${id}`),
        sql`, `
      )})`
    );

  return rows.map((row) => toPublicConcept(stripEmbedding(row)));
}

export async function searchPublishedByVector(
  query: string,
  limit = 3
): Promise<{ row: PublishedKnowledgePublic; score: number }[]> {
  try {
    const embedding = await generateEmbedding(query);
    const embeddingLiteral = `[${embedding.join(",")}]`;

    const rows = await db
      .select({
        row: eiePublishedKnowledge,
        score: sql<number>`1 - (${eiePublishedKnowledge.embedding} <=> ${embeddingLiteral}::vector)`,
      })
      .from(eiePublishedKnowledge)
      .where(sql`${eiePublishedKnowledge.embedding} IS NOT NULL`)
      .orderBy(sql`${eiePublishedKnowledge.embedding} <=> ${embeddingLiteral}::vector`)
      .limit(limit);

    return rows.map(({ row, score }) => ({
      row: stripEmbedding(row),
      score: Number(score),
    }));
  } catch {
    const { rows } = await searchPublished({ query, page: 1, limit, tags: undefined });
    return rows.map((row, index) => ({
      row,
      score: Math.max(0.5, 1 - index * 0.1),
    }));
  }
}
