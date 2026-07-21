import { detectVideoPlatform } from "@/lib/eie/url-patterns";
import { fetchYouTubeCaptions } from "@/lib/eie/transcription/youtube";
import { transcribeSocialVideo } from "@/lib/eie/transcription/social-video";

export async function fetchVideoTranscript(url: string): Promise<string> {
  const platform = detectVideoPlatform(url);

  if (platform === "youtube") {
    try {
      return await fetchYouTubeCaptions(url);
    } catch (captionError) {
      const message =
        captionError instanceof Error ? captionError.message : "Caption extraction failed";
      throw new Error(
        `YouTube caption extraction failed (${message}). Enable captions on the video or upload a transcript file instead.`
      );
    }
  }

  if (platform === "vimeo" || platform === "tiktok" || platform === "facebook" || platform === "instagram") {
    return transcribeSocialVideo(url);
  }

  throw new Error("Unsupported video platform URL");
}

export { transcribeMediaBuffer } from "@/lib/eie/transcription/whisper";
