import { NextRequest } from "next/server";
import { db } from "@/db";
import { eieSynthesisDrafts } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireAdmin, isAuthFailure } from "@/lib/eie/auth";
import { eieError, eieOk, eieValidationError } from "@/lib/eie/api-response";
import { mergeSplitSchema } from "@/lib/zod/eie-schemas";
import { extractConceptsFromText } from "@/lib/eie/extraction/concept-extractor";
import { synthesisToDraftInsert } from "@/lib/eie/mappers";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (isAuthFailure(auth)) return auth;

  const body = await req.json();
  const parsed = mergeSplitSchema.safeParse(body);
  if (!parsed.success) {
    return eieValidationError(parsed.error.issues);
  }

  if (parsed.data.action === "merge") {
    const drafts = await db
      .select()
      .from(eieSynthesisDrafts)
      .where(inArray(eieSynthesisDrafts.id, parsed.data.sourceDraftIds));

    if (drafts.length !== parsed.data.sourceDraftIds.length) {
      return eieError("MUTATION_VIOLATION", "One or more draft IDs not found", 400);
    }

    const mergedText = drafts
      .map(
        (draft) =>
          `# ${draft.conceptName}\n${draft.summary}\n${draft.practicalExplanation}`
      )
      .join("\n\n");

    const synthesized = await extractConceptsFromText(mergedText);
    const primary = synthesized[0];

    const [created] = await db
      .insert(eieSynthesisDrafts)
      .values({
        ...synthesisToDraftInsert(
          {
            ...primary,
            conceptName: parsed.data.mergedConceptName,
            category: parsed.data.category,
          },
          drafts[0]?.sourceId ?? null
        ),
        status: "needs_revision",
        reviewedBy: auth.userId,
        reviewedAt: new Date(),
      })
      .returning();

    await db
      .update(eieSynthesisDrafts)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(inArray(eieSynthesisDrafts.id, parsed.data.sourceDraftIds));

    return eieOk({ action: "merge", draft: created });
  }

  const { sourceDraftId, definitions } = parsed.data;
  const [sourceDraft] = await db
    .select()
    .from(eieSynthesisDrafts)
    .where(eq(eieSynthesisDrafts.id, sourceDraftId))
    .limit(1);

  if (!sourceDraft) {
    return eieError("NOT_FOUND", "Source draft not found", 404);
  }

  const createdDrafts = [];
  for (const definition of definitions) {
    const scopedText = `${sourceDraft.summary}\n\nScope:\n${definition.scope}`;
    const synthesized = await extractConceptsFromText(scopedText);
    const concept = synthesized[0];

    const [created] = await db
      .insert(eieSynthesisDrafts)
      .values({
        ...synthesisToDraftInsert(
          {
            ...concept,
            conceptName: definition.conceptName,
            category: definition.category,
          },
          sourceDraft.sourceId
        ),
        status: "needs_revision",
        reviewedBy: auth.userId,
        reviewedAt: new Date(),
      })
      .returning();

    createdDrafts.push(created);
  }

  await db
    .update(eieSynthesisDrafts)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(eq(eieSynthesisDrafts.id, sourceDraftId));

  return eieOk({ action: "split", drafts: createdDrafts });
}
