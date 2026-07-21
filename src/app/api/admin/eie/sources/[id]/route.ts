import { NextRequest } from "next/server";
import { db } from "@/db";
import { eieKnowledgeSources, eieSynthesisDrafts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, isAuthFailure } from "@/lib/eie/auth";
import { eieError, eieOk } from "@/lib/eie/api-response";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin();
  if (isAuthFailure(auth)) return auth;

  const { id } = await context.params;
  const [source] = await db
    .select()
    .from(eieKnowledgeSources)
    .where(eq(eieKnowledgeSources.id, id))
    .limit(1);

  if (!source) {
    return eieError("NOT_FOUND", "Source not found", 404);
  }

  const drafts = await db
    .select({
      id: eieSynthesisDrafts.id,
      conceptName: eieSynthesisDrafts.conceptName,
      status: eieSynthesisDrafts.status,
      category: eieSynthesisDrafts.category,
      updatedAt: eieSynthesisDrafts.updatedAt,
    })
    .from(eieSynthesisDrafts)
    .where(eq(eieSynthesisDrafts.sourceId, id));

  return eieOk({
    source,
    drafts,
    pipeline: {
      isProcessing: source.status === "processing",
      isComplete: source.status === "success",
      isFailed: source.status === "failed",
      draftCount: drafts.length,
    },
  });
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin();
  if (isAuthFailure(auth)) return auth;

  const { id } = await context.params;
  const [deleted] = await db
    .delete(eieKnowledgeSources)
    .where(eq(eieKnowledgeSources.id, id))
    .returning({ id: eieKnowledgeSources.id });

  if (!deleted) {
    return eieError("NOT_FOUND", "Source not found", 404);
  }

  return eieOk({ id: deleted.id });
}
