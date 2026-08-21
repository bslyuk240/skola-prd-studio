const WHISPER_MODEL = process.env.EIE_WHISPER_MODEL ?? "openai/whisper-1";
const MAX_WHISPER_BYTES = 25 * 1024 * 1024;

type OpenRouterSttResponse = {
  text?: string;
  error?: { message?: string };
  message?: string;
};

/** Map MIME type / extension to OpenRouter input_audio.format values. */
export function resolveOpenRouterAudioFormat(
  mimeType: string | undefined,
  filename: string
): string {
  if (mimeType === "audio/mpeg" || mimeType === "audio/mp3") return "mp3";
  if (mimeType === "audio/wav" || mimeType === "audio/x-wav") return "wav";
  if (mimeType === "audio/flac") return "flac";
  if (mimeType === "audio/ogg" || mimeType === "audio/opus") return "ogg";
  if (mimeType === "audio/webm") return "webm";
  if (mimeType === "audio/aac") return "aac";
  if (
    mimeType === "audio/mp4" ||
    mimeType === "audio/m4a" ||
    mimeType === "audio/x-m4a"
  ) {
    return "m4a";
  }
  if (mimeType === "video/webm") return "webm";
  if (mimeType === "video/mp4") return "m4a";

  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "mp3":
      return "mp3";
    case "wav":
      return "wav";
    case "flac":
      return "flac";
    case "ogg":
      return "ogg";
    case "webm":
      return "webm";
    case "aac":
      return "aac";
    case "m4a":
    case "mp4":
      return "m4a";
    default:
      return "m4a";
  }
}

export async function transcribeMediaBuffer(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  credits?: import("@/lib/eie/ai-credits").EieCreditAccumulator
): Promise<string> {
  if (buffer.length > MAX_WHISPER_BYTES) {
    throw new Error("Media file exceeds the 25 MB Whisper transcription limit");
  }

  if (buffer.length === 0) {
    throw new Error("Media file is empty");
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const format = resolveOpenRouterAudioFormat(mimeType, filename);
  const baseUrl = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

  const res = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "SkolaTech PRD Studio",
    },
    body: JSON.stringify({
      model: WHISPER_MODEL,
      input_audio: {
        data: buffer.toString("base64"),
        format,
      },
    }),
  });

  const payload = (await res.json().catch(() => ({}))) as OpenRouterSttResponse;

  if (!res.ok) {
    const detail =
      payload.error?.message ??
      payload.message ??
      `Transcription request failed (${res.status})`;
    throw new Error(detail);
  }

  const text = payload.text?.trim();
  if (!text) {
    throw new Error("Whisper returned an empty transcript");
  }

  credits?.recordWhisper();

  return text;
}
