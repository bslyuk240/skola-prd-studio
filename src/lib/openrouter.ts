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

export async function generateText(prompt: string, model = DEFAULT_MODEL): Promise<string> {
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
  });
  return completion.choices[0]?.message?.content ?? "";
}
