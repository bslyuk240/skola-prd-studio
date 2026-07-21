"use client";

import { Badge } from "@/components/ui/badge";
import type { AuthoritativeSource, DraftEnrichmentMetadata } from "@/lib/eie/types/enrichment";

type AuthoritativeSourcesPanelProps = {
  metadata: unknown;
};

function readMetadata(metadata: unknown): DraftEnrichmentMetadata {
  if (typeof metadata === "object" && metadata !== null && !Array.isArray(metadata)) {
    return metadata as DraftEnrichmentMetadata;
  }
  return {};
}

export function AuthoritativeSourcesPanel({ metadata }: AuthoritativeSourcesPanelProps) {
  const meta = readMetadata(metadata);
  const sources = meta.enrichmentSources ?? [];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Authoritative sources</h3>
        {meta.enrichmentProvider ? (
          <Badge variant="outline" className="text-xs capitalize">
            {meta.enrichmentProvider.replace(/_/g, " ")}
          </Badge>
        ) : null}
      </div>

      {meta.sourceContext ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted-foreground">Source perspective</p>
          <p className="mt-1 text-sm text-muted-foreground">{meta.sourceContext}</p>
        </div>
      ) : null}

      {meta.enrichmentWarning ? (
        <p className="mt-3 text-xs text-amber-500">{meta.enrichmentWarning}</p>
      ) : null}

      {sources.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No authoritative public documentation was attached to this draft.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {sources.map((source: AuthoritativeSource) => (
            <div key={source.url} className="rounded-lg border border-border p-3">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold hover:underline"
              >
                {source.title}
              </a>
              <p className="mt-1 text-xs text-muted-foreground">{source.domain}</p>
              <p className="mt-2 line-clamp-6 text-xs text-muted-foreground whitespace-pre-wrap">
                {source.excerpt}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
