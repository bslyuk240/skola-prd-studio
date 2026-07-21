import type { EieSourceType } from "@/lib/eie/constants";

const VIDEO_URL_PATTERN = /(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com)/i;
const GITHUB_URL_PATTERN = /github\.com/i;

const EXTENSION_MAP: Record<string, EieSourceType> = {
  pdf: "pdf",
  md: "markdown_file",
  markdown: "markdown_file",
  txt: "personal_note",
  mp4: "video_upload",
  webm: "video_upload",
  m4a: "video_upload",
  epub: "book",
};

export function detectSourceTypeFromUrl(url: string): EieSourceType | null {
  try {
    const parsed = new URL(url);
    if (VIDEO_URL_PATTERN.test(parsed.hostname + parsed.pathname)) {
      return "video_url";
    }
    if (GITHUB_URL_PATTERN.test(parsed.hostname)) {
      return "github_repo";
    }
    if (/\.pdf(\?|#|$)/i.test(parsed.pathname)) {
      return "pdf";
    }
    if (/\.(md|markdown)(\?|#|$)/i.test(parsed.pathname)) {
      return "markdown_file";
    }
    return "official_doc";
  } catch {
    return null;
  }
}

export function detectSourceTypeFromFilename(filename: string): EieSourceType | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return EXTENSION_MAP[ext] ?? null;
}

export function detectSourceTypeFromMime(mimeType: string): EieSourceType | null {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "text/markdown" || mimeType === "text/plain") return "markdown_file";
  if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) return "video_upload";
  return null;
}

export type SourceDetectionInput =
  | { kind: "url"; url: string }
  | { kind: "file"; filename: string; mimeType?: string }
  | { kind: "text"; content: string };

export function detectSourceType(input: SourceDetectionInput): EieSourceType {
  if (input.kind === "url") {
    return detectSourceTypeFromUrl(input.url) ?? "official_doc";
  }
  if (input.kind === "file") {
    return (
      detectSourceTypeFromMime(input.mimeType ?? "") ??
      detectSourceTypeFromFilename(input.filename) ??
      "personal_note"
    );
  }
  return "personal_note";
}
