export const EIE_PROCESSING_STAGES = [
  "queued",
  "extracting_text",
  "identifying_concepts",
  "enriching_sources",
  "synthesizing_concepts",
  "saving_drafts",
  "complete",
] as const;

export type EieProcessingStage = (typeof EIE_PROCESSING_STAGES)[number];

export const PROCESSING_STAGE_INFO: Record<
  EieProcessingStage,
  { label: string; progress: number }
> = {
  queued: { label: "Queued", progress: 5 },
  extracting_text: { label: "Extracting text", progress: 20 },
  identifying_concepts: { label: "Identifying concepts", progress: 35 },
  enriching_sources: { label: "Fetching authoritative docs", progress: 55 },
  synthesizing_concepts: { label: "Synthesizing from sources", progress: 75 },
  saving_drafts: { label: "Saving drafts", progress: 90 },
  complete: { label: "Complete", progress: 100 },
};

export type SourceProcessingView = {
  stage: EieProcessingStage | null;
  label: string;
  progress: number;
  isActive: boolean;
};

function readMetadataRecord(metadata: unknown): Record<string, unknown> {
  if (typeof metadata === "object" && metadata !== null && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

export function getSourceProcessingView(
  status: string,
  metadata: unknown
): SourceProcessingView | null {
  if (status === "success") {
    return {
      stage: "complete",
      label: PROCESSING_STAGE_INFO.complete.label,
      progress: 100,
      isActive: false,
    };
  }

  if (status !== "pending" && status !== "processing") {
    return null;
  }

  const meta = readMetadataRecord(metadata);
  const stage = meta.processingStage as EieProcessingStage | undefined;
  const info =
    stage && stage in PROCESSING_STAGE_INFO
      ? PROCESSING_STAGE_INFO[stage]
      : status === "pending"
        ? PROCESSING_STAGE_INFO.queued
        : { label: "Processing", progress: 25 };

  return {
    stage: stage ?? (status === "pending" ? "queued" : null),
    label: info.label,
    progress: info.progress,
    isActive: true,
  };
}
