"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { SourceProcessingProgress } from "@/components/eie/source-processing-progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EieSourceListRow = {
  id: string;
  name: string;
  sourceType: string;
  status: string;
  errorMessage: string | null;
  sourceUrl: string | null;
  metadata?: unknown;
};

function statusBadgeClass(status: string): string {
  switch (status) {
    case "success":
      return "text-emerald-600 border-emerald-200 bg-emerald-50";
    case "failed":
      return "text-red-600 border-red-200 bg-red-50";
    case "processing":
      return "text-amber-500 border-amber-200 bg-amber-50";
    default:
      return "";
  }
}

function isActiveStatus(status: string): boolean {
  return status === "pending" || status === "processing";
}

function mapApiSource(source: Record<string, unknown>): EieSourceListRow {
  return {
    id: String(source.id),
    name: String(source.name),
    sourceType: String(source.sourceType),
    status: String(source.status),
    errorMessage: source.errorMessage ? String(source.errorMessage) : null,
    sourceUrl: source.sourceUrl ? String(source.sourceUrl) : null,
    metadata: source.metadata,
  };
}

export function RecentSourcesList({ sources: initialSources }: { sources: EieSourceListRow[] }) {
  const [sources, setSources] = useState(initialSources);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => {
    setSources(initialSources);
  }, [initialSources]);

  const hasActiveSources = sources.some((source) => isActiveStatus(source.status));

  useEffect(() => {
    if (!hasActiveSources) return;

    let cancelled = false;

    async function pollSources() {
      try {
        const res = await fetch("/api/admin/eie/sources?page=1&limit=8");
        const json = (await res.json()) as {
          success?: boolean;
          data?: { rows?: Record<string, unknown>[] };
        };

        if (cancelled || !res.ok || !json.success || !json.data?.rows) {
          return;
        }

        setSources((current) => {
          const polled = json.data!.rows!.map(mapApiSource);
          const polledById = new Map(polled.map((source) => [source.id, source]));

          return current.map((source) => polledById.get(source.id) ?? source);
        });
      } catch {
        // Ignore transient network errors during polling.
      }
    }

    void pollSources();
    const intervalId = window.setInterval(pollSources, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [hasActiveSources]);

  async function retrySource(sourceId: string) {
    setRetryingId(sourceId);
    try {
      const res = await fetch(`/api/admin/eie/sources/${sourceId}/process`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message ?? "Retry failed");
      }

      setSources((current) =>
        current.map((source) =>
          source.id === sourceId
            ? {
                ...source,
                status: "pending",
                errorMessage: null,
                metadata: { processingStage: "queued" },
              }
            : source
        )
      );
      toast.success("Processing restarted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Retry failed");
    } finally {
      setRetryingId(null);
    }
  }

  if (sources.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No ingestion transactions exist. Add a source to begin processing.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {sources.map((source) => (
        <div key={source.id} className="rounded-lg border border-border p-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{source.name}</p>
              <p className="text-xs capitalize text-muted-foreground">
                {source.sourceType.replace(/_/g, " ")}
              </p>
              {source.sourceUrl ? (
                <p className="mt-1 truncate text-xs text-muted-foreground">{source.sourceUrl}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {source.status === "failed" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={retryingId === source.id}
                  onClick={() => retrySource(source.id)}
                >
                  {retryingId === source.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                  Retry
                </Button>
              ) : null}
              <Badge
                variant="outline"
                className={cn("capitalize", statusBadgeClass(source.status))}
              >
                {source.status}
              </Badge>
            </div>
          </div>

          <SourceProcessingProgress status={source.status} metadata={source.metadata} />

          {source.status === "failed" && source.errorMessage ? (
            <p className="mt-2 text-xs text-red-600">{source.errorMessage}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function useTrackedEieSource(initialSource: EieSourceListRow | null) {
  const [source, setSource] = useState(initialSource);
  const notifiedTerminalRef = useRef<string | null>(null);

  useEffect(() => {
    setSource(initialSource);
    notifiedTerminalRef.current = null;
  }, [initialSource]);

  const sourceId = source?.id;
  const sourceStatus = source?.status;
  const isActive = sourceStatus ? isActiveStatus(sourceStatus) : false;

  useEffect(() => {
    if (!sourceId || !isActive) return;

    let cancelled = false;

    async function pollSource() {
      try {
        const res = await fetch(`/api/admin/eie/sources/${sourceId}`);
        const json = (await res.json()) as {
          success?: boolean;
          data?: { source?: Record<string, unknown> };
        };

        if (cancelled || !res.ok || !json.success || !json.data?.source) {
          return;
        }

        const next = mapApiSource(json.data.source);
        setSource(next);

        if (next.status === "success" && notifiedTerminalRef.current !== next.id) {
          notifiedTerminalRef.current = next.id;
          toast.success("Ingestion complete. Review drafts in the Review queue.");
        } else if (next.status === "failed" && notifiedTerminalRef.current !== next.id) {
          notifiedTerminalRef.current = next.id;
          toast.error(next.errorMessage ?? "Ingestion failed.");
        }
      } catch {
        // Ignore transient network errors during polling.
      }
    }

    void pollSource();
    const intervalId = window.setInterval(pollSource, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [sourceId, isActive]);

  return source;
}
