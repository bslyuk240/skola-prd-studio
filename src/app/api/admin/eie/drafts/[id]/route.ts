import { NextRequest } from "next/server";
import { db } from "@/db";
import { eieSynthesisDrafts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, isAuthFailure } from "@/lib/eie/auth";
import { eieError, eieOk, eieValidationError } from "@/lib/eie/api-response";
import { updateDraftSchema } from "@/lib/zod/eie-schemas";
import { sanitizeDraftUpdate } from "@/lib/eie/security/sanitize";

type RouteContext = { params: Promise<{ id: string }> };

function mapDraftUpdate(body: Record<string, unknown>) {
  const mapped: Record<string, unknown> = { ...body };
  if ("conceptName" in mapped) mapped.conceptName = mapped.conceptName;
  if ("practicalExplanation" in mapped) {
    mapped.practicalExplanation = mapped.practicalExplanation;
  }
  if ("bestPractices" in mapped) mapped.bestPractices = mapped.bestPractices;
  if ("tradeOffs" in mapped) mapped.tradeOffs = mapped.tradeOffs;
  if ("alternativeApproaches" in mapped) {
    mapped.alternativeApproaches = mapped.alternativeApproaches;
  }
  if ("securityConsiderations" in mapped) {
    mapped.securityConsiderations = mapped.securityConsiderations;
  }
  if ("commonMistakes" in mapped) mapped.commonMistakes = mapped.commonMistakes;
  if ("implementationRecommendations" in mapped) {
    mapped.implementationRecommendations = mapped.implementationRecommendations;
  }
  return mapped;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin();
  if (isAuthFailure(auth)) return auth;

  const { id } = await context.params;
  const [draft] = await db
    .select()
    .from(eieSynthesisDrafts)
    .where(eq(eieSynthesisDrafts.id, id))
    .limit(1);

  if (!draft) {
    return eieError("NOT_FOUND", "Draft not found", 404);
  }

  return eieOk(draft);
}

async function updateDraft(req: NextRequest, id: string, userId: string) {
  const body = await req.json();
  const sanitizedBody = sanitizeDraftUpdate(mapDraftUpdate(body));
  const parsed = updateDraftSchema.safeParse(sanitizedBody);
  if (!parsed.success) {
    return eieValidationError(parsed.error.issues);
  }

  const { conceptName, ...rest } = parsed.data;

  const [updated] = await db
    .update(eieSynthesisDrafts)
    .set({
      ...rest,
      ...(conceptName ? { conceptName } : {}),
      reviewedBy: userId,
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

export async function PUT(req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin();
  if (isAuthFailure(auth)) return auth;
  const { id } = await context.params;
  return updateDraft(req, id, auth.userId);
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin();
  if (isAuthFailure(auth)) return auth;
  const { id } = await context.params;
  return updateDraft(req, id, auth.userId);
}
