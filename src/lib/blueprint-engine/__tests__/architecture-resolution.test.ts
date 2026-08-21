import { describe, expect, it } from "vitest";
import { buildBlueprintSeedFromWizard } from "@/lib/blueprint-engine/extract/from-wizard-context";
import {
  applyArchitectureResolution,
  approveBlueprintModel,
  isBlueprintModelApproved,
} from "@/lib/blueprint-engine/apply-architecture-resolution";
import type { ProjectContext } from "@/lib/ai-prompts";

const ctx: ProjectContext = {
  appName: "Stack Test App",
  shortDescription: "Test app",
  hostingProvider: "Vercel",
  frontendFramework: "Next.js",
};

describe("architecture resolution", () => {
  it("lets user correct stack choice before approval", () => {
    const seed = buildBlueprintSeedFromWizard(ctx);
    expect(seed.stack.hosting).toBe("Vercel");

    const updated = applyArchitectureResolution(seed, {
      stack: { hosting: "Netlify" },
    });

    expect(updated.stack.hosting).toBe("Netlify");
    expect(isBlueprintModelApproved(updated)).toBe(false);
  });

  it("marks model approved only after explicit approval", () => {
    const seed = buildBlueprintSeedFromWizard(ctx);
    const approved = approveBlueprintModel(seed);

    expect(approved.metadata.modelApprovedAt).toBeTruthy();
    expect(isBlueprintModelApproved(approved)).toBe(true);
  });

  it("grandfathers legacy projects with generated documents", () => {
    const seed = buildBlueprintSeedFromWizard(ctx);
    expect(
      isBlueprintModelApproved(seed, [{ status: "ready", content: "Generated PRD" }])
    ).toBe(true);
  });

  it("grandfathers projects missing a stored blueprint when documents exist", () => {
    expect(
      isBlueprintModelApproved(null, [{ status: "ready", content: "Generated PRD" }])
    ).toBe(true);
  });

  it("blocks new projects until architecture is explicitly approved", () => {
    const seed = buildBlueprintSeedFromWizard(ctx);
    expect(isBlueprintModelApproved(seed, [{ status: "pending", content: null }])).toBe(false);
    expect(isBlueprintModelApproved(null, [{ status: "pending", content: null }])).toBe(false);
  });
});
