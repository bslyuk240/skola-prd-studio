import { describe, expect, it } from "vitest";
import {
  detectSourceType,
  detectSourceTypeFromFilename,
  detectSourceTypeFromUrl,
} from "@/lib/eie/detector";

describe("detector", () => {
  it("detects YouTube URLs as video_url", () => {
    expect(
      detectSourceTypeFromUrl("https://www.youtube.com/watch?v=abc123")
    ).toBe("video_url");
  });

  it("detects GitHub URLs as github_repo", () => {
    expect(detectSourceTypeFromUrl("https://github.com/org/repo")).toBe(
      "github_repo"
    );
  });

  it("detects PDF URLs", () => {
    expect(detectSourceTypeFromUrl("https://example.com/guide.pdf")).toBe("pdf");
  });

  it("detects markdown files by filename", () => {
    expect(detectSourceTypeFromFilename("architecture.md")).toBe("markdown_file");
  });

  it("falls back to personal_note for plain text uploads", () => {
    expect(
      detectSourceType({ kind: "text", content: "Some engineering notes" })
    ).toBe("personal_note");
  });
});
