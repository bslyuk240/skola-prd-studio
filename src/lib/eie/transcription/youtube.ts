import { YoutubeTranscript } from "youtube-transcript";
import { extractYouTubeVideoId } from "@/lib/eie/url-patterns";

export async function fetchYouTubeCaptions(url: string): Promise<string> {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    throw new Error("Could not parse YouTube video ID from URL");
  }

  const segments = await YoutubeTranscript.fetchTranscript(videoId);
  if (!segments.length) {
    throw new Error("No captions found for this YouTube video");
  }

  const text = segments
    .map((segment) => segment.text.trim())
    .filter(Boolean)
    .join("\n")
    .trim();

  if (text.length < 20) {
    throw new Error("YouTube captions were too short to extract useful content");
  }

  return text;
}
