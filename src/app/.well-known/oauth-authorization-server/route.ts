import { NextRequest, NextResponse } from "next/server";
import { siteUrlFromRequest } from "@/lib/site-url";

// RFC 8414 Authorization Server Metadata — lets an MCP client discover how to
// register itself and obtain tokens for this server without hardcoded config.
export async function GET(req: NextRequest) {
  const issuer = siteUrlFromRequest(req);
  return NextResponse.json({
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/api/oauth/token`,
    registration_endpoint: `${issuer}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["mcp"],
  });
}
