import { NextRequest } from "next/server";
import { requireAuthenticated, isAuthFailure } from "@/lib/eie/auth";
import { eieError, eieOk } from "@/lib/eie/api-response";
import {
  getPublishedBySlug,
  getRelatedConcepts,
  incrementPublishedViews,
} from "@/lib/eie/search";
import { toPublicConcept } from "@/lib/eie/public-serializer";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await requireAuthenticated();
  if (isAuthFailure(auth)) return auth;

  const { slug } = await context.params;
  const concept = await getPublishedBySlug(slug);

  if (!concept) {
    return eieError("NOT_FOUND", "Published concept not found", 404);
  }

  await incrementPublishedViews(slug);
  const relatedConcepts = await getRelatedConcepts(concept.id);

  return eieOk({
    concept: toPublicConcept(concept),
    relatedConcepts,
  });
}
