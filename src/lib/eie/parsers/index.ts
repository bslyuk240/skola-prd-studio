import type { EieKnowledgeSource } from "@/db/schema";
import { parseDocument } from "@/lib/eie/parsers/document";
import { extractTextFromUrl } from "@/lib/eie/parsers/url";

const DOCUMENT_TYPES = new Set([
  "pdf",
  "markdown_file",
  "personal_note",
  "book",
  "research_paper",
]);

const URL_TYPES = new Set([
  "video_url",
  "github_repo",
  "official_doc",
  "markdown_file",
  "research_paper",
]);

export async function extractText(source: EieKnowledgeSource): Promise<string> {
  if (source.rawContent?.trim()) {
    return source.rawContent.trim();
  }

  if (URL_TYPES.has(source.sourceType) && source.sourceUrl) {
    return extractTextFromUrl(source);
  }

  if (DOCUMENT_TYPES.has(source.sourceType)) {
    if (source.sourceType === "personal_note" && source.rawContent) {
      return parseDocument(source.rawContent, "personal_note");
    }
    throw new Error(`No extractable content for source type: ${source.sourceType}`);
  }

  if (source.sourceType === "video_upload") {
    throw new Error("Video upload transcription is not yet configured");
  }

  throw new Error(`Unsupported source type: ${source.sourceType}`);
}
