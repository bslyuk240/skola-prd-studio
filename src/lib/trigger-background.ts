import {
  BACKGROUND_SIGNATURE_HEADER,
  signBackgroundPayload,
} from "@/lib/background-function-auth";

/** Fire a Netlify background function with optional HMAC auth. */
export async function triggerBackground(url: string, payload: object): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const secret = process.env.BACKGROUND_FUNCTION_SECRET;

    if (secret) {
      headers[BACKGROUND_SIGNATURE_HEADER] = signBackgroundPayload(body, secret);
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    return res.ok;
  } catch (err) {
    console.error(
      "[trigger-background] dispatch failed:",
      err instanceof Error ? err.message : err
    );
    return false;
  } finally {
    clearTimeout(timer);
  }
}
