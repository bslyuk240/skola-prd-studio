import { db } from "@/db";
import { eieSynthesisDrafts } from "@/db/schema";
import { desc, inArray } from "drizzle-orm";
import { ConceptCard } from "@/components/eie/concept-card";

export default async function EieReviewQueuePage() {
  const drafts = await db
    .select()
    .from(eieSynthesisDrafts)
    .where(inArray(eieSynthesisDrafts.status, ["draft", "needs_revision"]))
    .orderBy(desc(eieSynthesisDrafts.updatedAt))
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Review Queue</h2>
        <p className="text-sm text-muted-foreground">
          Drafts awaiting admin review before publication
        </p>
      </div>

      {drafts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No drafts are waiting for review. Ingest a source to generate synthesis drafts.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {drafts.map((draft) => (
            <ConceptCard
              key={draft.id}
              variant="admin"
              href={`/admin/eie/review/${draft.id}`}
              concept={{
                id: draft.id,
                conceptName: draft.conceptName,
                summary: draft.summary,
                category: draft.category,
                tags: draft.tags,
                status: draft.status,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
