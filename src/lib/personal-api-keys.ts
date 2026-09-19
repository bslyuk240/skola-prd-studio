import crypto from "crypto";

const TOKEN_PREFIX = "prds_pat_";

export function generatePersonalApiKey(): { plainTextToken: string; tokenHash: string } {
  const raw = crypto.randomBytes(24).toString("hex");
  const plainTextToken = `${TOKEN_PREFIX}${raw}`;
  return { plainTextToken, tokenHash: hashPersonalApiKey(plainTextToken) };
}

export function hashPersonalApiKey(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function maskPersonalApiKey(keyId: string): string {
  return `${TOKEN_PREFIX}••••••••${keyId.slice(0, 6)}`;
}
