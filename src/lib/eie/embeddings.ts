import { openrouter } from "@/lib/openrouter";
import { EIE_EMBEDDING_DIMENSIONS } from "@/lib/eie/constants";

const EMBEDDING_MODEL =
  process.env.EIE_EMBEDDING_MODEL ?? "openai/text-embedding-3-small";

export async function generateEmbedding(text: string): Promise<number[]> {
  const input = text.slice(0, 8000);
  const response = await openrouter.embeddings.create({
    model: EMBEDDING_MODEL,
    input,
  });

  const vector = response.data[0]?.embedding;
  if (!vector?.length) {
    throw new Error("Embedding generation returned empty vector");
  }

  if (vector.length !== EIE_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected ${EIE_EMBEDDING_DIMENSIONS} dimensions, got ${vector.length}`
    );
  }

  return vector;
}

export function buildEmbeddingInput(fields: {
  conceptName: string;
  category: string;
  summary: string;
  practicalExplanation: string;
  tags?: string[] | null;
}): string {
  return [
    fields.conceptName,
    fields.category,
    fields.tags?.join(" ") ?? "",
    fields.summary,
    fields.practicalExplanation,
  ]
    .filter(Boolean)
    .join("\n");
}
