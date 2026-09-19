import type { NextRequest } from "next/server";

/** Canonical site origin — prefers Netlify's own URL over the request origin, which can resolve to an internal/edge address. */
export function siteUrlFromRequest(req: NextRequest): string {
  return process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? req.nextUrl.origin;
}
