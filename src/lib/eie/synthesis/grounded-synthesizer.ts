import { openrouter, DEFAULT_MODEL } from "@/lib/openrouter";
import {
  synthesisFieldsSchema,
  type SynthesisFields,
} from "@/lib/zod/eie-schemas";
import type { ConceptEnrichment, ConceptSeed } from "@/lib/eie/types/enrichment";
import type { EieCreditAccumulator } from "@/lib/eie/ai-credits";

function resolveExtractionModel(): string {
  const configured = process.env.EIE_EXTRACTION_MODEL ?? DEFAULT_MODEL;
  return configured === "google/gemini-2.0-flash-001" ? DEFAULT_MODEL : configured;
}

function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  return trimmed;
}

function formatAuthoritativeBlock(enrichment: ConceptEnrichment): string {
  if (enrichment.sources.length === 0) {
    return "No authoritative public documentation was retrieved.";
  }

  return enrichment.sources
    .map(
      (source, index) =>
        `[Authoritative Source ${index + 1}] ${source.title}\nURL: ${source.url}\nExcerpt:\n${source.excerpt}`
    )
    .join("\n\n---\n\n");
}

function buildReferencesFromEnrichment(enrichment: ConceptEnrichment): SynthesisFields["references"] {
  return enrichment.sources.map((source) => ({
    title: source.title,
    url: source.url,
  }));
}

export async function synthesizeGroundedConcept(
  seed: ConceptSeed,
  enrichment: ConceptEnrichment,
  rawText: string,
  credits?: EieCreditAccumulator
): Promise<SynthesisFields> {
  const authoritativeBlock = formatAuthoritativeBlock(enrichment);
  const hasAuthoritative = enrichment.sources.length > 0;

  const completion = await openrouter.chat.completions.create({
    model: resolveExtractionModel(),
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You produce engineering synthesis grounded in AUTHORITATIVE PUBLIC DOCUMENTATION.
Return JSON: { "concept": { ... } }

The concept object must include:
conceptName, category, tags (string array), summary, practicalExplanation, bestPractices (string[]),
tradeOffs (string[] or {alternative,pro,con}[]), alternativeApproaches (string[]),
securityConsiderations (string[]), commonMistakes (string[]),
implementationRecommendations (object or string[]), references ({title,url}[]).

Rules:
- PRIMARY grounding: use the authoritative source excerpts. Do not contradict them.
- SECONDARY context: ingested source perspective may inform emphasis but is NOT authority.
- Every references entry MUST use a URL from the authoritative sources block when available.
- If no authoritative sources exist, be conservative and explicitly note limitations in summary.
- Do not invent RFC numbers, CVE IDs, or vendor features absent from provided text.
- references must include at least one entry when authoritative sources were provided.`,
      },
      {
        role: "user",
        content: `Concept seed:
- Name: ${seed.conceptName}
- Category: ${seed.category}
- Tags: ${(seed.tags ?? []).join(", ") || "none"}
- Source perspective: ${seed.sourceContext}

Authoritative public documentation:
${authoritativeBlock}

Ingested source excerpt (secondary context only):
${rawText.slice(0, 12_000)}

Authoritative sources available: ${hasAuthoritative ? "yes" : "no"}`,
      },
    ],
    max_tokens: 8000,
  });

  credits?.recordChatUsage(completion.usage);

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Grounded synthesis returned empty response");
  }

  const parsed = JSON.parse(stripJsonFence(content)) as { concept?: unknown };
  const concept = synthesisFieldsSchema.parse(parsed.concept);

  const enrichmentRefs = buildReferencesFromEnrichment(enrichment);
  const mergedRefs = [...enrichmentRefs];
  const seenUrls = new Set(enrichmentRefs.map((ref) => ref.url).filter(Boolean));

  for (const ref of concept.references ?? []) {
    if (ref.url && seenUrls.has(ref.url)) continue;
    mergedRefs.push(ref);
    if (ref.url) seenUrls.add(ref.url);
  }

  return {
    ...concept,
    conceptName: seed.conceptName,
    category: seed.category,
    tags: seed.tags ?? concept.tags,
    references: mergedRefs,
  };
}
