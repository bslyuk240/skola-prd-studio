import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { oauthClients, oauthAuthorizationCodes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateAuthorizationCode } from "@/lib/oauth/tokens";

function withQuery(url: string, params: Record<string, string>) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) {
    if (v) u.searchParams.set(k, v);
  }
  return u.toString();
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "access_denied" }, { status: 401 });

  const form = await req.formData();
  const decision = form.get("decision")?.toString();
  const clientId = form.get("client_id")?.toString();
  const redirectUri = form.get("redirect_uri")?.toString();
  const state = form.get("state")?.toString() ?? "";
  const codeChallenge = form.get("code_challenge")?.toString();
  const scope = form.get("scope")?.toString();

  if (!clientId || !redirectUri || !codeChallenge) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  // Re-validate the client + redirect_uri server-side — never trust the form
  // values alone, and never redirect to an unregistered/mismatched URI.
  const [client] = await db.select().from(oauthClients).where(eq(oauthClients.id, clientId)).limit(1);
  const redirectUris = (client?.redirectUris as string[] | undefined) ?? [];
  if (!client || !redirectUris.includes(redirectUri)) {
    return NextResponse.json({ error: "invalid_client" }, { status: 400 });
  }

  // 303 forces the browser to GET the target regardless of this request's
  // method — NextResponse.redirect() defaults to 307, which preserves POST
  // and breaks OAuth callbacks (they only accept GET).
  if (decision !== "allow") {
    return NextResponse.redirect(withQuery(redirectUri, { error: "access_denied", state }), 303);
  }

  const { plainCode, codeHash, expiresAt } = generateAuthorizationCode();
  await db.insert(oauthAuthorizationCodes).values({
    codeHash,
    clientId,
    userId,
    redirectUri,
    codeChallenge,
    scope: scope || null,
    expiresAt,
  });

  return NextResponse.redirect(withQuery(redirectUri, { code: plainCode, state }), 303);
}
