import { openrouter, DEFAULT_MODEL } from "@/lib/openrouter";
import { synthesisFieldsSchema, type SynthesisFields } from "@/lib/zod/eie-schemas";

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

export async function extractConceptsFromText(
  rawText: string,
  existingConceptNames: string[] = []
): Promise<SynthesisFields[]> {
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
        content: `You extract discrete engineering concepts from technical material.
Return JSON: { "concepts": [ ... ] }
Each concept must match this shape exactly:
conceptName, category (one of: architecture, security_compliance, database_persistence, scaling_performance, microservices_event_driven, frontend_ux_patterns, api_design, devops_deployment),
tags (string array), summary, practicalExplanation, bestPractices (string[]),
tradeOffs (string[] or {alternative,pro,con}[]), alternativeApproaches (string[]),
securityConsiderations (string[]), commonMistakes (string[]),
implementationRecommendations (object or string[]), references ({title,url?}[]).
Identify 1-8 distinct concepts. Do not return raw transcript chunks.${existing}`,
      },
      {
        role: "user",
        content: rawText.slice(0, 60_000),
      },
    ],
    max_tokens: 8000,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Concept extraction returned empty response");
  }

  const parsed = JSON.parse(stripJsonFence(content)) as { concepts?: unknown[] };
  if (!Array.isArray(parsed.concepts) || parsed.concepts.length === 0) {
    throw new Error("Concept extraction returned no concepts");
  }

  return parsed.concepts.map((item) => synthesisFieldsSchema.parse(item));
}

export async function synthesizeConcept(
  rawText: string,
  conceptName: string
): Promise<SynthesisFields> {
  const concepts = await extractConceptsFromText(rawText);
  const match =
    concepts.find(
      (c) => c.conceptName.toLowerCase() === conceptName.toLowerCase()
    ) ?? concepts[0];
  return match;
}
