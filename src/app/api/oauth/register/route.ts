import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { oauthClients } from "@/db/schema";
import { z } from "zod";

// RFC 7591 Dynamic Client Registration. Intentionally open/unauthenticated —
// that's the spec: a client has no credentials yet when it first registers.
const schema = z.object({
  client_name: z.string().max(200).optional(),
  redirect_uris: z.array(z.url()).min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_client_metadata", error_description: "redirect_uris is required" },
      { status: 400 }
    );
  }

  const [client] = await db
    .insert(oauthClients)
    .values({
      clientName: parsed.data.client_name ?? "MCP Client",
      redirectUris: parsed.data.redirect_uris,
    })
    .returning();

  return NextResponse.json(
    {
      client_id: client.id,
      client_name: client.clientName,
      redirect_uris: parsed.data.redirect_uris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    { status: 201 }
  );
}
