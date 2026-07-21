import { NextRequest } from "next/server";
import { db } from "@/db";
import { eieKnowledgeSources, eieSynthesisDrafts } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAdmin, isAuthFailure } from "@/lib/eie/auth";
import { eieError, eieOk } from "@/lib/eie/api-response";
import {
  prepareSourceForProcessing,
  queueSourceProcessing,
} from "@/lib/eie/orchestrator";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, context: RouteContext) {
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

  if (source.status === "processing") {
    return eieError(
      "MUTATION_VIOLATION",
      "Source is already being processed",
      409
    );
  }

  await prepareSourceForProcessing(id);
  const dispatch = await queueSourceProcessing(id);

  const [updated] = await db
    .select()
    .from(eieKnowledgeSources)
    .where(eq(eieKnowledgeSources.id, id))
    .limit(1);

  return eieOk(
    {
      source: updated,
      processing: dispatch,
    },
    202
  );
}
