import { NextRequest } from "next/server";
import { db } from "@/db";
import { eieSynthesisDrafts } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireAdmin, isAuthFailure } from "@/lib/eie/auth";
import { eieOk, eieValidationError } from "@/lib/eie/api-response";
import { draftListQuerySchema } from "@/lib/zod/eie-schemas";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (isAuthFailure(auth)) return auth;

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = draftListQuerySchema.safeParse(params);
  if (!parsed.success) {
    return eieValidationError(parsed.error.issues);
  }

  const { status, sourceId, category, page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (status) conditions.push(eq(eieSynthesisDrafts.status, status));
  if (sourceId) conditions.push(eq(eieSynthesisDrafts.sourceId, sourceId));
  if (category) conditions.push(eq(eieSynthesisDrafts.category, category));

  const whereClause = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(eieSynthesisDrafts)
    .where(whereClause)
    .orderBy(desc(eieSynthesisDrafts.updatedAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eieSynthesisDrafts)
    .where(whereClause);

  return eieOk({
    rows,
    pagination: {
      currentPage: page,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / limit)),
      totalCount: count ?? 0,
    },
  });
}
