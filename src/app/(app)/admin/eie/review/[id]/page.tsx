import { notFound } from "next/navigation";
import { db } from "@/db";
import { eieKnowledgeSources, eieSynthesisDrafts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SynthesisComparisonView } from "@/components/eie/synthesis-comparison-view";
import { AuthoritativeSourcesPanel } from "@/components/eie/authoritative-sources-panel";
import { DraftReviewActions } from "@/components/eie/draft-review-actions";
import { Badge } from "@/components/ui/badge";
import { draftToFormState } from "@/lib/eie/draft-form-state";
import { draftHasInjectionWarning } from "@/lib/eie/security/sanitize";

type PageProps = { params: Promise<{ id: string }> };

export default async function EieReviewDetailPage({ params }: PageProps) {
  const { id } = await params;

  const [draft] = await db
    .select()
    .from(eieSynthesisDrafts)
    .where(eq(eieSynthesisDrafts.id, id))
    .limit(1);

  if (!draft) notFound();

  const injectionWarning = draftHasInjectionWarning(draft);

  let rawContent = "";
  if (draft.sourceId) {
    const [source] = await db
      .select({ rawContent: eieKnowledgeSources.rawContent })
      .from(eieKnowledgeSources)
      .where(eq(eieKnowledgeSources.id, draft.sourceId))
      .limit(1);
    rawContent = source?.rawContent ?? "";
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">{draft.conceptName}</h2>
          {injectionWarning ? (
            <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/30">
              Prompt injection pattern detected
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground capitalize">
          Status: {draft.status.replace(/_/g, " ")}
        </p>
      </div>

      <DraftReviewActions draftId={draft.id} conceptName={draft.conceptName} />

      <AuthoritativeSourcesPanel metadata={draft.metadata} />

      <SynthesisComparisonView
        draftId={draft.id}
        rawContent={rawContent}
        initial={draftToFormState(draft)}
      />
    </div>
  );
}
