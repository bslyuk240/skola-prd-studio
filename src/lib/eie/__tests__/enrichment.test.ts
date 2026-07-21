import { describe, expect, it } from "vitest";
import {
  isAuthoritativeHostname,
  normalizeHostname,
} from "@/lib/eie/enrichment/allowlist";
import { extractRelevantExcerpt } from "@/lib/eie/enrichment/excerpt";

describe("authoritative allowlist", () => {
  it("accepts trusted documentation domains", () => {
    expect(isAuthoritativeHostname("developer.mozilla.org")).toBe(true);
    expect(isAuthoritativeHostname("owasp.org")).toBe(true);
    expect(isAuthoritativeHostname(normalizeHostname("www.datatracker.ietf.org"))).toBe(true);
  });

  it("rejects unknown domains", () => {
    expect(isAuthoritativeHostname("random-blog.example.com")).toBe(false);
  });
});

describe("extractRelevantExcerpt", () => {
  it("prefers paragraphs related to the concept", () => {
    const text = [
      "Unrelated intro about company history and team structure across multiple regions.",
      "",
      "JWT refresh tokens should be rotated and stored in HttpOnly cookies to reduce XSS risk.",
      "",
      "Another unrelated paragraph about office locations and travel policies for staff.",
      "",
      "More filler about quarterly planning and roadmap reviews for unrelated product areas.",
    ].join("\n");

    const excerpt = extractRelevantExcerpt(text, "JWT Refresh Tokens", ["security"]);
    expect(excerpt).toContain("JWT refresh tokens");
  });
});
