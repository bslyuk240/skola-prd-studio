import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { oauthAuthorizationCodes, oauthTokens } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  generateAccessToken,
  generateRefreshToken,
  hashOauthToken,
  verifyPkceS256,
} from "@/lib/oauth/tokens";

function tokenError(error: string, description?: string) {
  return NextResponse.json({ error, error_description: description }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return tokenError("invalid_request", "Expected a form-encoded body");

  const grantType = form.get("grant_type")?.toString();

  if (grantType === "authorization_code") {
    const code = form.get("code")?.toString();
    const redirectUri = form.get("redirect_uri")?.toString();
    const clientId = form.get("client_id")?.toString();
    const codeVerifier = form.get("code_verifier")?.toString();

    if (!code || !redirectUri || !clientId || !codeVerifier) {
      return tokenError("invalid_request", "code, redirect_uri, client_id, and code_verifier are required");
    }

    const codeHash = hashOauthToken(code);
    const [authCode] = await db
      .select()
      .from(oauthAuthorizationCodes)
      .where(and(eq(oauthAuthorizationCodes.codeHash, codeHash), isNull(oauthAuthorizationCodes.usedAt)))
      .limit(1);

    if (
      !authCode ||
      authCode.expiresAt < new Date() ||
      authCode.clientId !== clientId ||
      authCode.redirectUri !== redirectUri
    ) {
      return tokenError("invalid_grant", "Authorization code is invalid, expired, or already used");
    }

    if (!verifyPkceS256(codeVerifier, authCode.codeChallenge)) {
      return tokenError("invalid_grant", "PKCE verification failed");
    }

    // Single-use — mark consumed before issuing tokens.
    await db
      .update(oauthAuthorizationCodes)
      .set({ usedAt: new Date() })
      .where(eq(oauthAuthorizationCodes.id, authCode.id));

    const access = generateAccessToken();
    const refresh = generateRefreshToken();

    await db.insert(oauthTokens).values({
      clientId: authCode.clientId,
      userId: authCode.userId,
      accessTokenHash: access.tokenHash,
      refreshTokenHash: refresh.tokenHash,
      scope: authCode.scope,
      accessTokenExpiresAt: access.expiresAt,
      refreshTokenExpiresAt: refresh.expiresAt,
    });

    return NextResponse.json({
      access_token: access.plainToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: refresh.plainToken,
      scope: authCode.scope ?? "mcp",
    });
  }

  if (grantType === "refresh_token") {
    const refreshToken = form.get("refresh_token")?.toString();
    if (!refreshToken) return tokenError("invalid_request", "refresh_token is required");

    const refreshTokenHash = hashOauthToken(refreshToken);
    const [existing] = await db
      .select()
      .from(oauthTokens)
      .where(and(eq(oauthTokens.refreshTokenHash, refreshTokenHash), isNull(oauthTokens.revokedAt)))
      .limit(1);

    if (!existing || !existing.refreshTokenExpiresAt || existing.refreshTokenExpiresAt < new Date()) {
      return tokenError("invalid_grant", "Refresh token is invalid, revoked, or expired");
    }

    const access = generateAccessToken();
    const refresh = generateRefreshToken();

    // Rotate in place — old access/refresh tokens stop working immediately.
    await db
      .update(oauthTokens)
      .set({
        accessTokenHash: access.tokenHash,
        refreshTokenHash: refresh.tokenHash,
        accessTokenExpiresAt: access.expiresAt,
        refreshTokenExpiresAt: refresh.expiresAt,
        lastUsedAt: new Date(),
      })
      .where(eq(oauthTokens.id, existing.id));

    return NextResponse.json({
      access_token: access.plainToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: refresh.plainToken,
      scope: existing.scope ?? "mcp",
    });
  }

  return tokenError("unsupported_grant_type");
}
