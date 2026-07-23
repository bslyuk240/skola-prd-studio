import OpenAI from "openai";

export const openrouter = new OpenAI({
  baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY!,
  defaultHeaders: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    "X-Title": "SkolaTech PRD Studio",
  },
});

export const DEFAULT_MODEL = "google/gemini-3.5-flash";

const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [1000, 2500];
// Without this, a hung upstream call can outlive the caller's own execution
// window (e.g. a Netlify background function killed by its platform limit)
// and never reach the catch block that reverts a document's stuck status.
const REQUEST_TIMEOUT_MS = 90_000;

function isRetryable(err: unknown): boolean {
  if (err instanceof OpenAI.APIError) {
    // No status = connection/timeout error. 429 = rate limited. 5xx = upstream failure.
    return err.status === undefined || err.status === 429 || err.status >= 500;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateText(prompt: string, model = DEFAULT_MODEL): Promise<string> {
  let lastErr: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const completion = await openrouter.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are an expert software architect and product manager at SkolaTech PRD Studio. Generate professional, detailed, and actionable documentation. Use clean Markdown formatting.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 8000,
      }, { timeout: REQUEST_TIMEOUT_MS });
      return completion.choices[0]?.message?.content ?? "";
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_RETRIES || !isRetryable(err)) throw err;
      console.error(`[generateText] attempt ${attempt + 1} failed, retrying`, err instanceof Error ? err.message : err);
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastErr;
}
