import type { SynthesisFields } from "@/lib/zod/eie-schemas";
import type { NewEieSynthesisDraft } from "@/db/schema";

export function synthesisToDraftInsert(
  fields: SynthesisFields,
  sourceId: string | null
): Omit<NewEieSynthesisDraft, "id" | "createdAt" | "updatedAt" | "status"> {
  return {
    sourceId,
    conceptName: fields.conceptName,
    category: fields.category,
    tags: fields.tags ?? [],
    summary: fields.summary,
    practicalExplanation: fields.practicalExplanation,
    bestPractices: fields.bestPractices,
    tradeOffs: fields.tradeOffs,
    alternativeApproaches: fields.alternativeApproaches,
    securityConsiderations: fields.securityConsiderations,
    commonMistakes: fields.commonMistakes,
    implementationRecommendations: fields.implementationRecommendations,
    references: fields.references ?? [],
  };
}

export function slugifyConceptName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export async function ensureUniqueSlug(
  baseSlug: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  let slug = baseSlug;
  let counter = 2;
  while (await exists(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
  return slug;
}
