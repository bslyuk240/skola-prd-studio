import Link from "next/link";
import { db } from "@/db";
import {
  eieKnowledgeSources,
  eiePublishedKnowledge,
  eieSynthesisDrafts,
} from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function EieCommandCenterPage() {
  const [sourceCounts, draftCounts, publishedCount, recentSources] = await Promise.all([
    db
      .select({
        status: eieKnowledgeSources.status,
        count: sql<number>`count(*)::int`,
      })
      .from(eieKnowledgeSources)
      .groupBy(eieKnowledgeSources.status),
    db
      .select({
        status: eieSynthesisDrafts.status,
        count: sql<number>`count(*)::int`,
      })
      .from(eieSynthesisDrafts)
      .groupBy(eieSynthesisDrafts.status),
    db.select({ count: sql<number>`count(*)::int` }).from(eiePublishedKnowledge),
    db
      .select()
      .from(eieKnowledgeSources)
      .orderBy(desc(eieKnowledgeSources.createdAt))
      .limit(8),
  ]);

  const countMap = (rows: { status: string; count: number }[]) =>
    Object.fromEntries(rows.map((r) => [r.status, r.count]));

  const sources = countMap(sourceCounts);
  const drafts = countMap(draftCounts);
  const pendingReview =
    (drafts.draft ?? 0) + (drafts.needs_revision ?? 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Command Center</h2>
          <p className="text-sm text-muted-foreground">
            Ingestion queue, draft review, and published knowledge metrics
          </p>
        </div>
        <Link href="/admin/eie/ingest">
          <Button>Add Source</Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Active sources" value={(sources.processing ?? 0) + (sources.pending ?? 0)} />
        <MetricCard title="Pending review" value={pendingReview} />
        <MetricCard title="Published concepts" value={publishedCount[0]?.count ?? 0} />
        <MetricCard title="Failed ingestions" value={sources.failed ?? 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Recent ingestions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentSources.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No ingestion transactions exist. Add a source to begin processing.
            </p>
          ) : (
            recentSources.map((source) => (
              <div
                key={source.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border p-3"
              >
                <div>
                  <p className="text-sm font-semibold">{source.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {source.sourceType.replace(/_/g, " ")}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {source.status}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
