import { openrouter } from "@/lib/openrouter";
import type { EieCreditAccumulator } from "@/lib/eie/ai-credits";

const WHISPER_MODEL = process.env.EIE_WHISPER_MODEL ?? "openai/whisper-1";
const MAX_WHISPER_BYTES = 25 * 1024 * 1024;

export async function transcribeMediaBuffer(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  credits?: EieCreditAccumulator
): Promise<string> {
  if (buffer.length > MAX_WHISPER_BYTES) {
    throw new Error("Media file exceeds the 25 MB Whisper transcription limit");
  }

  if (buffer.length === 0) {
    throw new Error("Media file is empty");
  }

  const file = new File([new Uint8Array(buffer)], filename, { type: mimeType });
  const result = await openrouter.audio.transcriptions.create({
    file,
    model: WHISPER_MODEL,
  });

  const text = result.text?.trim();
  if (!text) {
    throw new Error("Whisper returned an empty transcript");
  }

  credits?.recordWhisper();

  return text;
}
