import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticated, isAuthFailure } from "@/lib/eie/auth";
import { eieError, eieValidationError } from "@/lib/eie/api-response";
import { exportConceptSchema } from "@/lib/zod/eie-schemas";
import { getPublishedBySlug } from "@/lib/eie/search";
import { conceptToMarkdown } from "@/lib/eie/export";
import { toPublicConcept } from "@/lib/eie/public-serializer";
import { checkRateLimit, getClientIp } from "@/lib/eie/rate-limit";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await requireAuthenticated();
  if (isAuthFailure(auth)) return auth;

  const ip = getClientIp(req);
  const rate = checkRateLimit(`eie-export:${ip}`, 15, 60_000);
  if (!rate.allowed) {
    return eieError(
      "RATE_LIMIT_EXCEEDED",
      `Export rate limit exceeded. Retry in ${rate.retryAfterSeconds}s.`,
      429
    );
  }

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = exportConceptSchema.safeParse(params);
  if (!parsed.success) {
    return eieValidationError(parsed.error.issues);
  }

  const { slug } = await context.params;
  const concept = await getPublishedBySlug(slug);
  if (!concept) {
    return eieError("CONCEPT_NOT_PUBLISHED", "Published concept not found", 404);
  }

  const publicConcept = toPublicConcept(concept);

  if (parsed.data.format === "pdf") {
    return eieError(
      "VALIDATION_ERROR",
      "PDF export is not yet available. Use format=markdown.",
      400
    );
  }

  const markdown = conceptToMarkdown(publicConcept);
  const filename = `${slug}.md`;

  return new NextResponse(markdown, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
