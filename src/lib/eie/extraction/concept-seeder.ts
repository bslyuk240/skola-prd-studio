import { openrouter, DEFAULT_MODEL } from "@/lib/openrouter";
import { EIE_CATEGORIES } from "@/lib/eie/constants";
import { conceptSeedSchema, type ConceptSeed } from "@/lib/eie/types/enrichment";
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

export async function extractConceptSeeds(
  rawText: string,
  existingConceptNames: string[] = [],
  credits?: EieCreditAccumulator
): Promise<ConceptSeed[]> {
  const existing =
    existingConceptNames.length > 0
      ? `\nExisting concepts to avoid duplicating: ${existingConceptNames.join(", ")}`
      : "";

  const completion = await openrouter.chat.completions.create({
    model: resolveExtractionModel(),
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You identify discrete engineering concepts from technical source material.
Return JSON: { "concepts": [ ... ] }
Each item must include:
- conceptName (canonical engineering topic name)
- category (one of: ${EIE_CATEGORIES.join(", ")})
- tags (optional string array)
- sourceContext (1-3 sentences summarizing what the SOURCE MATERIAL says about this concept — not general knowledge)

Identify 1-8 distinct concepts. Do not write full synthesis fields.${existing}`,
      },
      {
        role: "user",
        content: rawText.slice(0, 60_000),
      },
    ],
    max_tokens: 4000,
  });

  credits?.recordChatUsage(completion.usage);

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Concept seeding returned empty response");
  }

  const parsed = JSON.parse(stripJsonFence(content)) as { concepts?: unknown[] };
  if (!Array.isArray(parsed.concepts) || parsed.concepts.length === 0) {
    throw new Error("Concept seeding returned no concepts");
  }

  return parsed.concepts.map((item) => conceptSeedSchema.parse(item));
}
