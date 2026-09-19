import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { EIE_ADMIN_ROLES } from "@/lib/eie/constants";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhook(.*)",
  "/api/mcp(.*)",
  // QStash / inline worker — auth via x-eie-internal-secret in route handler
  "/api/admin/eie/internal/process",
  // Netlify background functions — invoked server-to-server by our own route
  // handlers (no Clerk browser session), so this middleware's broad matcher
  // must not subject them to auth.protect(). Without this, Clerk rejects the
  // request with a 404 before it ever reaches the function, and every
  // document generation silently fails.
  "/.netlify/functions/(.*)",
  // OAuth 2.1 discovery/registration/token endpoints — called by MCP clients
  // before they have a user session. /oauth/authorize and /api/oauth/authorize
  // (the consent screen + its submit handler) stay protected on purpose.
  "/.well-known/oauth-authorization-server",
  "/.well-known/oauth-protected-resource",
  "/api/oauth/register",
  "/api/oauth/token",
]);

const isAdminRoute = createRouteMatcher(["/admin/eie(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  if (isAdminRoute(req)) {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
    if (!role || !(EIE_ADMIN_ROLES as readonly string[]).includes(role)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }
});

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)","/(api|trpc)(.*)"],
};
