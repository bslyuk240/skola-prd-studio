import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/lib/eie/rate-limit";

describe("rate-limit", () => {
  it("returns 429 after limit exceeded", () => {
    const key = `test-${Date.now()}`;
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(key, 10, 60_000).allowed).toBe(true);
    }
    const blocked = checkRateLimit(key, 10, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });
});
