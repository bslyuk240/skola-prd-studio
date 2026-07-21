import { createHmac, timingSafeEqual } from "node:crypto";

export const BACKGROUND_SIGNATURE_HEADER = "x-background-signature";

export function signBackgroundPayload(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function verifyBackgroundPayload(
  body: string,
  signature: string | null | undefined,
  secret: string | undefined
): boolean {
  if (!secret || !signature) return false;

  const expected = signBackgroundPayload(body, secret);
  if (expected.length !== signature.length) return false;

  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

export function verifyBackgroundRequest(
  rawBody: string,
  headers: Record<string, string | undefined> | null | undefined,
  secret: string | undefined
): boolean {
  const signature =
    headers?.[BACKGROUND_SIGNATURE_HEADER] ??
    headers?.["X-Background-Signature"];
  return verifyBackgroundPayload(rawBody, signature, secret);
}
