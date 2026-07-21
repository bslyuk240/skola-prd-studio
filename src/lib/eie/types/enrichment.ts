import { z } from "zod";
import { eieCategorySchema } from "@/lib/zod/eie-schemas";

export const conceptSeedSchema = z.object({
  conceptName: z.string().min(2).max(255),
  category: eieCategorySchema,
  tags: z.array(z.string().min(1).max(64)).max(20).optional(),
  sourceContext: z.string().min(10).max(2000),
});

export type ConceptSeed = z.infer<typeof conceptSeedSchema>;

export type AuthoritativeSource = {
  title: string;
  url: string;
  excerpt: string;
  domain: string;
};

export type ConceptEnrichment = {
  sources: AuthoritativeSource[];
  searchQuery: string;
  provider: "tavily" | "serper" | "llm_fallback" | "none";
  warning?: string;
};

export type DraftEnrichmentMetadata = {
  sourceContext?: string;
  enrichmentSources?: AuthoritativeSource[];
  enrichmentProvider?: ConceptEnrichment["provider"];
  enrichmentWarning?: string;
};
