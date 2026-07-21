import { db } from "@/db";
import { eiePrdRetrievals, eiePublishedKnowledge } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

export type DocumentEieRetrieval = {
  id: string;
  relevanceScore: string;
  retrievedAt: Date;
  slug: string;
  conceptName: string;
  summary: string;
  category: string;
};

export async function getDocumentRetrievals(
  projectId: string,
  documentId: string
): Promise<DocumentEieRetrieval[]> {
  return db
    .select({
      id: eiePrdRetrievals.id,
      relevanceScore: eiePrdRetrievals.relevanceScore,
      retrievedAt: eiePrdRetrievals.retrievedAt,
      slug: eiePublishedKnowledge.slug,
      conceptName: eiePublishedKnowledge.conceptName,
      summary: eiePublishedKnowledge.summary,
      category: eiePublishedKnowledge.category,
    })
    .from(eiePrdRetrievals)
    .innerJoin(
      eiePublishedKnowledge,
      eq(eiePrdRetrievals.publishedKnowledgeId, eiePublishedKnowledge.id)
    )
    .where(
      and(
        eq(eiePrdRetrievals.projectId, projectId),
        eq(eiePrdRetrievals.documentId, documentId)
      )
    )
    .orderBy(desc(eiePrdRetrievals.relevanceScore));
}
