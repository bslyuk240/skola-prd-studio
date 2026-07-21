import { describe, expect, it } from "vitest";
import { ingestSourceSchema, updateDraftSchema } from "@/lib/zod/eie-schemas";

describe("eie-schemas", () => {
  it("accepts valid personal note ingest payload", () => {
    const parsed = ingestSourceSchema.safeParse({
      sourceType: "personal_note",
      name: "Auth patterns note",
      content: "Use short-lived access tokens with refresh rotation.",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts Facebook video URL ingest payload", () => {
    const parsed = ingestSourceSchema.safeParse({
      sourceType: "video_url",
      name: "Sign in lifecycle",
      sourceUrl: "https://www.facebook.com/share/v/18x4J25z3u/",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts document URL ingest payload", () => {
    const parsed = ingestSourceSchema.safeParse({
      sourceType: "official_doc",
      name: "Architecture guide",
      sourceUrl: "https://example.com/docs/architecture",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects personal note below minimum length", () => {
    const parsed = ingestSourceSchema.safeParse({
      sourceType: "personal_note",
      name: "Too short",
      content: "short",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts partial draft updates", () => {
    const parsed = updateDraftSchema.safeParse({
      summary: "Updated summary with enough characters.",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid category values", () => {
    const parsed = updateDraftSchema.safeParse({
      category: "not_a_real_category",
    });
    expect(parsed.success).toBe(false);
  });
});
