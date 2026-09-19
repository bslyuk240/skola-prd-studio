import { NextRequest, NextResponse } from "next/server";
import { siteUrlFromRequest } from "@/lib/site-url";

// RFC 9728 Protected Resource Metadata — returned to point an MCP client at
// this server's authorization server after it gets a 401 from the MCP endpoint.
export async function GET(req: NextRequest) {
  const origin = siteUrlFromRequest(req);
  return NextResponse.json({
    resource: `${origin}/api/mcp/studio/v1`,
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
  });
}
