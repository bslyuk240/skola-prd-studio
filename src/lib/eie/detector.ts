import type { EieSourceType } from "@/lib/eie/constants";
import {
  GITHUB_URL_PATTERN,
  MARKDOWN_URL_PATTERN,
  PDF_URL_PATTERN,
  VIDEO_URL_PATTERN,
} from "@/lib/eie/url-patterns";

export {
  classifyIngestUrl,
  detectVideoPlatform,
  extractYouTubeVideoId,
  isGitHubUrl,
  isVideoUrl,
  VIDEO_URL_PATTERN,
  GITHUB_URL_PATTERN,
} from "@/lib/eie/url-patterns";

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
    const hostPath = `${parsed.hostname}${parsed.pathname}`;

    if (VIDEO_URL_PATTERN.test(hostPath)) {
      return "video_url";
    }
    if (GITHUB_URL_PATTERN.test(parsed.hostname)) {
      return "github_repo";
    }
    if (PDF_URL_PATTERN.test(parsed.pathname)) {
      return "pdf";
    }
    if (MARKDOWN_URL_PATTERN.test(parsed.pathname)) {
      return "markdown_file";
    }
    if (/arxiv\.org|doi\.org|researchgate\.net/i.test(hostPath)) {
      return "research_paper";
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
