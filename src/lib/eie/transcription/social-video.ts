import {
  decodeEscapedUrl,
  detectVideoPlatform,
  isAllowedMediaDownloadUrl,
  type VideoPlatform,
} from "@/lib/eie/url-patterns";
import { transcribeMediaBuffer } from "@/lib/eie/transcription/whisper";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;

async function fetchPageHtml(url: string, platform: VideoPlatform): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": BROWSER_USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });

  if (!res.ok) {
    if (platform === "facebook" && (res.status === 400 || res.status === 403)) {
      throw new Error(
        "Facebook blocked server access to this video. Download the video and use File Upload, or paste the transcript in Personal Note."
      );
    }
    throw new Error(`Failed to fetch video page: HTTP ${res.status}`);
  }

  return res.text();
}

function firstMatch(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeEscapedUrl(match[1]);
    }
  }
  return null;
}

async function resolveMediaDownloadUrl(
  pageUrl: string,
  platform: VideoPlatform
): Promise<{ downloadUrl: string; mimeType: string }> {
  const html = await fetchPageHtml(pageUrl, platform);

  if (platform === "vimeo") {
    const configUrl = firstMatch(html, [
      /"config_url"\s*:\s*"([^"]+)"/,
      /playerConfigUrl\s*=\s*"([^"]+)"/,
    ]);
    if (configUrl) {
      const configRes = await fetch(configUrl, {
        headers: { "User-Agent": BROWSER_USER_AGENT },
      });
      if (configRes.ok) {
        const config = (await configRes.json()) as {
          request?: { files?: { progressive?: { url?: string }[] } };
        };
        const progressive = config.request?.files?.progressive?.find((file) => file.url);
        if (progressive?.url && isAllowedMediaDownloadUrl(progressive.url)) {
          return { downloadUrl: progressive.url, mimeType: "video/mp4" };
        }
      }
    }
  }

  const candidate = firstMatch(html, [
    /property="og:video:secure_url"\s+content="([^"]+)"/i,
    /property="og:video:url"\s+content="([^"]+)"/i,
    /property="og:video"\s+content="([^"]+)"/i,
    /"downloadAddr"\s*:\s*"([^"]+)"/,
    /"playAddr"\s*:\s*"([^"]+)"/,
    /"contentUrl"\s*:\s*"([^"]+)"/,
    /"video_url"\s*:\s*"([^"]+)"/,
  ]);

  if (!candidate) {
    throw new Error(
      `Could not locate downloadable media for ${platform}. The post may be private or login-protected.`
    );
  }

  if (!isAllowedMediaDownloadUrl(candidate)) {
    throw new Error("Resolved media URL is not from an allowed video CDN host");
  }

  return { downloadUrl: candidate, mimeType: "video/mp4" };
}

async function downloadMediaBuffer(downloadUrl: string): Promise<Buffer> {
  const res = await fetch(downloadUrl, {
    headers: { "User-Agent": BROWSER_USER_AGENT },
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`Failed to download media file: HTTP ${res.status}`);
  }

  const lengthHeader = res.headers.get("content-length");
  if (lengthHeader && Number(lengthHeader) > MAX_DOWNLOAD_BYTES) {
    throw new Error("Media file exceeds the 25 MB transcription download limit");
  }

  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_DOWNLOAD_BYTES) {
    throw new Error("Media file exceeds the 25 MB transcription download limit");
  }

  if (arrayBuffer.byteLength === 0) {
    throw new Error("Downloaded media file is empty");
  }

  return Buffer.from(arrayBuffer);
}

export async function transcribeSocialVideo(url: string): Promise<string> {
  const platform = detectVideoPlatform(url);
  if (platform === "youtube" || platform === "unknown") {
    throw new Error(`Social transcription does not handle platform: ${platform}`);
  }

  const { downloadUrl, mimeType } = await resolveMediaDownloadUrl(url, platform);
  const buffer = await downloadMediaBuffer(downloadUrl);
  return transcribeMediaBuffer(buffer, `${platform}-video.mp4`, mimeType);
}
