"use client";

import { Progress } from "@/components/ui/progress";
import { getSourceProcessingView } from "@/lib/eie/processing-stages";

type SourceProcessingProgressProps = {
  status: string;
  metadata?: unknown;
};

export function SourceProcessingProgress({
  status,
  metadata,
}: SourceProcessingProgressProps) {
  const view = getSourceProcessingView(status, metadata);

  if (!view?.isActive) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{view.label}</p>
        <p className="text-xs tabular-nums text-muted-foreground">{view.progress}%</p>
      </div>
      <Progress value={view.progress} aria-label={`Processing: ${view.label}`} />
    </div>
  );
}
