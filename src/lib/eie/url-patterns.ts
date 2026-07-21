/** Shared URL classification helpers for ingest, validation, and parsing. */

export const VIDEO_URL_PATTERN =
  /(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|facebook\.com|fb\.watch|fb\.com|instagram\.com|instagr\.am)/i;

export const GITHUB_URL_PATTERN = /github\.com/i;

export const PDF_URL_PATTERN = /\.pdf(\?|#|$)/i;

export const MARKDOWN_URL_PATTERN = /\.(md|markdown)(\?|#|$)/i;

const ALLOWED_MEDIA_HOST_PATTERN =
  /(googlevideo\.com|fbcdn\.net|facebook\.com|tiktokcdn\.com|tiktokv\.com|tiktok\.com|vimeocdn\.com|vimeo\.com|cdninstagram\.com|instagram\.com)/i;

export type VideoPlatform =
  | "youtube"
  | "vimeo"
  | "tiktok"
  | "facebook"
  | "instagram"
  | "unknown";

export function isVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return VIDEO_URL_PATTERN.test(`${parsed.hostname}${parsed.pathname}`);
  } catch {
    return false;
  }
}

export function isGitHubUrl(url: string): boolean {
  try {
    return GITHUB_URL_PATTERN.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function classifyIngestUrl(url: string): "video" | "github" | "document" {
  if (isGitHubUrl(url)) return "github";
  if (isVideoUrl(url)) return "video";
  return "document";
}

export function detectVideoPlatform(url: string): VideoPlatform {
  try {
    const parsed = new URL(url);
    const hostPath = `${parsed.hostname}${parsed.pathname}`.toLowerCase();
    if (/youtube\.com|youtu\.be/.test(hostPath)) return "youtube";
    if (/vimeo\.com/.test(hostPath)) return "vimeo";
    if (/tiktok\.com/.test(hostPath)) return "tiktok";
    if (/facebook\.com|fb\.watch|fb\.com/.test(hostPath)) return "facebook";
    if (/instagram\.com|instagr\.am/.test(hostPath)) return "instagram";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace(/^\//, "").split("/")[0] || null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      return parsed.searchParams.get("v");
    }
    return null;
  } catch {
    return null;
  }
}

export function isAllowedMediaDownloadUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_MEDIA_HOST_PATTERN.test(parsed.hostname);
  } catch {
    return false;
  }
}

export function decodeEscapedUrl(value: string): string {
  return value.replace(/\\u0026/g, "&").replace(/\\\//g, "/").replace(/\\"/g, '"');
}
