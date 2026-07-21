import type { EieKnowledgeSource } from "@/db/schema";
import { parseDocument } from "@/lib/eie/parsers/document";
import { extractTextFromUrl } from "@/lib/eie/parsers/url";
import { fetchStoredObject } from "@/lib/eie/storage";
import type { EieCreditAccumulator } from "@/lib/eie/ai-credits";

const DOCUMENT_TYPES = new Set([
  "pdf",
  "markdown_file",
  "personal_note",
  "book",
  "research_paper",
]);

const FILE_UPLOAD_TYPES = new Set([
  "pdf",
  "markdown_file",
  "book",
  "research_paper",
  "official_doc",
  "video_upload",
]);

const URL_TYPES = new Set([
  "video_url",
  "github_repo",
  "official_doc",
  "markdown_file",
  "research_paper",
  "pdf",
  "book",
]);

function resolveMediaFilename(mimeType: string | undefined): string {
  if (mimeType?.startsWith("audio/")) return "upload.m4a";
  if (mimeType?.includes("webm")) return "upload.webm";
  return "upload.mp4";
}

async function extractTextFromFile(
  source: EieKnowledgeSource,
  credits?: EieCreditAccumulator
): Promise<string> {
  if (!source.fileKey) {
    throw new Error("File key is required for file-backed sources");
  }

  const buffer = await fetchStoredObject(source.fileKey);
  const metadata = source.metadata as { mimeType?: string } | null;
  const mimeType = metadata?.mimeType;

  if (source.sourceType === "video_upload") {
    const { transcribeMediaBuffer } = await import("@/lib/eie/transcription");
    return transcribeMediaBuffer(
      buffer,
      resolveMediaFilename(mimeType),
      mimeType ?? "video/mp4",
      credits
    );
  }

  if (
    source.sourceType === "pdf" ||
    source.sourceType === "markdown_file" ||
    source.sourceType === "book" ||
    source.sourceType === "research_paper"
  ) {
    return parseDocument(buffer, source.sourceType);
  }

  if (mimeType === "text/plain" || mimeType === "text/markdown") {
    return parseDocument(buffer, "markdown_file");
  }

  if (mimeType === "application/pdf") {
    return parseDocument(buffer, "pdf");
  }

  if (mimeType?.startsWith("video/") || mimeType?.startsWith("audio/")) {
    const { transcribeMediaBuffer } = await import("@/lib/eie/transcription");
    return transcribeMediaBuffer(
      buffer,
      resolveMediaFilename(mimeType),
      mimeType,
      credits
    );
  }

  throw new Error(`No extractable content for source type: ${source.sourceType}`);
}

export async function extractText(
  source: EieKnowledgeSource,
  credits?: EieCreditAccumulator
): Promise<string> {
  if (source.rawContent?.trim()) {
    return source.rawContent.trim();
  }

  if (source.fileKey && FILE_UPLOAD_TYPES.has(source.sourceType)) {
    return extractTextFromFile(source, credits);
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

  throw new Error(`Unsupported source type: ${source.sourceType}`);
}
