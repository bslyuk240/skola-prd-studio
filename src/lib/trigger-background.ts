import {
  BACKGROUND_SIGNATURE_HEADER,
  signBackgroundPayload,
} from "@/lib/background-function-auth";

export type BackgroundDispatchResult = {
  dispatched: boolean;
  status?: number;
  error?: string;
};

/** Fire a Netlify background function with optional HMAC auth. */
export async function triggerBackgroundWithResult(
  url: string,
  payload: object
): Promise<BackgroundDispatchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

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

    if (res.ok) {
      return { dispatched: true, status: res.status };
    }

    const responseText = await res.text().catch(() => "");
    console.error(
      `[trigger-background] dispatch rejected: ${res.status} ${responseText.slice(0, 200)}`
    );
    return {
      dispatched: false,
      status: res.status,
      error: responseText || `Background dispatch returned ${res.status}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[trigger-background] dispatch failed:", message);
    return { dispatched: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

/** @deprecated Prefer triggerBackgroundWithResult for error detail. */
export async function triggerBackground(url: string, payload: object): Promise<boolean> {
  const result = await triggerBackgroundWithResult(url, payload);
  return result.dispatched;
}
