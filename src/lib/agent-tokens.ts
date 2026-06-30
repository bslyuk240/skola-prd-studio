import crypto from "crypto";

const TOKEN_PREFIX = "prds_live_mcp_";

export function generateAgentToken(): { plainTextToken: string; tokenHash: string } {
  const raw = crypto.randomBytes(24).toString("hex");
  const plainTextToken = `${TOKEN_PREFIX}${raw}`;
  return { plainTextToken, tokenHash: hashAgentToken(plainTextToken) };
}

export function hashAgentToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function maskToken(connectionId: string): string {
  return `${TOKEN_PREFIX}••••••••${connectionId.slice(0, 6)}`;
}
