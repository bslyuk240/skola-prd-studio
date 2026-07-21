import { NextRequest } from "next/server";
import { db } from "@/db";
import { eieSynthesisDrafts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, isAuthFailure } from "@/lib/eie/auth";
import { eieError, eieOk } from "@/lib/eie/api-response";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin();
  if (isAuthFailure(auth)) return auth;

  const { id } = await context.params;
  const [updated] = await db
    .update(eieSynthesisDrafts)
    .set({
      status: "rejected",
      reviewedBy: auth.userId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(eieSynthesisDrafts.id, id))
    .returning();

  if (!updated) {
    return eieError("NOT_FOUND", "Draft not found", 404);
  }

  return eieOk(updated);
}
