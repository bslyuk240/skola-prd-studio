import crypto from "crypto";

const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const REFRESH_TOKEN_TTL_MS = 180 * 24 * 60 * 60 * 1000; // 180 days

export const ACCESS_TOKEN_TTL_SECONDS = ACCESS_TOKEN_TTL_MS / 1000;

export function hashOauthToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateAuthorizationCode() {
  const plainCode = crypto.randomBytes(32).toString("base64url");
  return { plainCode, codeHash: hashOauthToken(plainCode), expiresAt: new Date(Date.now() + CODE_TTL_MS) };
}

export function generateAccessToken() {
  const plainToken = `prds_at_${crypto.randomBytes(32).toString("base64url")}`;
  return { plainToken, tokenHash: hashOauthToken(plainToken), expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_MS) };
}

export function generateRefreshToken() {
  const plainToken = `prds_rt_${crypto.randomBytes(32).toString("base64url")}`;
  return { plainToken, tokenHash: hashOauthToken(plainToken), expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS) };
}

/** RFC 7636 PKCE S256 verification — constant-time comparison against the stored code_challenge. */
export function verifyPkceS256(codeVerifier: string, codeChallenge: string): boolean {
  if (!codeVerifier || !codeChallenge) return false;
  const computed = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
  const a = Buffer.from(computed);
  const b = Buffer.from(codeChallenge);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
