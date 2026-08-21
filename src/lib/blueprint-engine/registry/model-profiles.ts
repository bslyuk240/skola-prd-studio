import type { ModelProfile } from "@/lib/zod/blueprint-schemas";

export type ModelProfileDefinition = {
  profile: ModelProfile;
  label: string;
  description: string;
  /** OpenRouter slug — resolved at runtime, never written into generated docs as the only option */
  defaultOpenRouterModel: string;
};

export const MODEL_PROFILE_REGISTRY: Record<ModelProfile, ModelProfileDefinition> = {
  FAST: {
    profile: "FAST",
    label: "Fast",
    description: "Low-latency responses for chat, routing, and simple extraction",
    defaultOpenRouterModel: "google/gemini-3.1-flash-lite",
  },
  BALANCED: {
    profile: "BALANCED",
    label: "Balanced",
    description: "Default agent and document generation profile",
    defaultOpenRouterModel: "google/gemini-3.5-flash",
  },
  REASONING: {
    profile: "REASONING",
    label: "Reasoning",
    description: "Complex planning, incident analysis, multi-step decisions",
    defaultOpenRouterModel: "anthropic/claude-sonnet-4-5",
  },
  VISION: {
    profile: "VISION",
    label: "Vision",
    description: "Image and document understanding",
    defaultOpenRouterModel: "google/gemini-3.5-flash",
  },
  EMBEDDING: {
    profile: "EMBEDDING",
    label: "Embedding",
    description: "Vector embeddings — dimensions resolved per provider, not assumed 1536",
    defaultOpenRouterModel: "openai/text-embedding-3-small",
  },
};

export function resolveModelForProfile(profile: ModelProfile): string {
  return MODEL_PROFILE_REGISTRY[profile].defaultOpenRouterModel;
}
