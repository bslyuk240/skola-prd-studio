/** Convert model token usage into billable AI credits (aligned with doc generation scale). */
export function tokensToCredits(tokens: number): number {
  if (tokens <= 0) return 1;
  return Math.max(1, Math.ceil(tokens / 800));
}

export const EIE_WHISPER_CREDITS = 12;
export const EIE_EMBEDDING_CREDITS = 2;

type ChatUsage = {
  total_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
};

export class EieCreditAccumulator {
  private credits = 0;

  recordChatUsage(usage?: ChatUsage): void {
    const tokens =
      usage?.total_tokens ??
      (usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0);
    this.credits += tokensToCredits(tokens);
  }

  recordWhisper(): void {
    this.credits += EIE_WHISPER_CREDITS;
  }

  recordEmbedding(): void {
    this.credits += EIE_EMBEDDING_CREDITS;
  }

  getTotal(): number {
    return this.credits;
  }
}

export type OpenRouterChatUsage = ChatUsage;
