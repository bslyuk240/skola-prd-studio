import { describe, expect, it } from "vitest";
import {
  EieCreditAccumulator,
  EIE_EMBEDDING_CREDITS,
  EIE_WHISPER_CREDITS,
  tokensToCredits,
} from "@/lib/eie/ai-credits";

describe("tokensToCredits", () => {
  it("charges at least one credit per call", () => {
    expect(tokensToCredits(0)).toBe(1);
    expect(tokensToCredits(400)).toBe(1);
  });

  it("scales with token volume", () => {
    expect(tokensToCredits(1600)).toBe(2);
  });
});

describe("EieCreditAccumulator", () => {
  it("tracks chat, whisper, and embedding usage", () => {
    const credits = new EieCreditAccumulator();
    credits.recordChatUsage({ total_tokens: 1600 });
    credits.recordWhisper();
    credits.recordEmbedding();

    expect(credits.getTotal()).toBe(2 + EIE_WHISPER_CREDITS + EIE_EMBEDDING_CREDITS);
  });
});
