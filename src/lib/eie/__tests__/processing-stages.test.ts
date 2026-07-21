import { describe, expect, it } from "vitest";
import { getSourceProcessingView } from "@/lib/eie/processing-stages";

describe("getSourceProcessingView", () => {
  it("returns queued progress for pending sources", () => {
    const view = getSourceProcessingView("pending", {});

    expect(view).toMatchObject({
      stage: "queued",
      label: "Queued",
      progress: 5,
      isActive: true,
    });
  });

  it("returns stage progress from metadata while processing", () => {
    const view = getSourceProcessingView("processing", {
      processingStage: "enriching_sources",
    });

    expect(view).toMatchObject({
      stage: "enriching_sources",
      label: "Fetching authoritative docs",
      progress: 55,
      isActive: true,
    });
  });

  it("returns null for failed sources", () => {
    expect(getSourceProcessingView("failed", {})).toBeNull();
  });
});
