import type { PublishedKnowledgePublic } from "@/lib/eie/search";

/** Public API shape — strips internal lineage fields. */
export type PublicKnowledgeConcept = Omit<
  PublishedKnowledgePublic,
  "synthesisDraftId"
>;

export function toPublicConcept(
  row: PublishedKnowledgePublic
): PublicKnowledgeConcept {
  const { synthesisDraftId: _draftId, ...publicRow } = row;
  return publicRow;
}

export function toPublicConceptList(
  rows: PublishedKnowledgePublic[]
): PublicKnowledgeConcept[] {
  return rows.map(toPublicConcept);
}
