import type { ProjectBlueprint } from "@/lib/zod/blueprint-schemas";
import type { assumptionEntrySchema } from "@/lib/zod/blueprint-schemas";
import type { z } from "zod";
import { finalizeBlueprint } from "@/lib/blueprint-engine/plan/finalize-blueprint";
import type { ProjectContext } from "@/lib/ai-prompts";

type AssumptionEntry = z.infer<typeof assumptionEntrySchema>;

function hasLegacyGeneratedDocuments(
  documents: Array<{ status: string | null; content?: string | null }>
): boolean {
  return documents.some(
    (doc) => Boolean(doc.content?.trim()) || (doc.status !== null && doc.status !== "pending")
  );
}

export function isBlueprintModelApproved(
  blueprint: ProjectBlueprint | null | undefined,
  documents: Array<{ status: string | null; content?: string | null }> = []
): boolean {
  if (blueprint?.metadata.modelApprovedAt) return true;
  if (hasLegacyGeneratedDocuments(documents)) return true;
  return false;
}

export function approveBlueprintModel(blueprint: ProjectBlueprint): ProjectBlueprint {
  return {
    ...blueprint,
    metadata: {
      ...blueprint.metadata,
      modelApprovedAt: new Date().toISOString(),
    },
  };
}

export type ArchitectureResolutionUpdates = {
  stack?: Partial<ProjectBlueprint["stack"]>;
  assumptions?: AssumptionEntry[];
};

/** Apply stack and assumption edits, then re-run planners (P10-2). */
export function applyArchitectureResolution(
  blueprint: ProjectBlueprint,
  updates: ArchitectureResolutionUpdates,
  ctx?: Pick<
    ProjectContext,
    "mainFeatures" | "adminFeatures" | "integrationNeeds" | "paymentProvider"
  >
): ProjectBlueprint {
  const merged: ProjectBlueprint = {
    ...blueprint,
    stack: {
      ...blueprint.stack,
      ...updates.stack,
      locked: true,
    },
    assumptions: updates.assumptions ?? blueprint.assumptions,
  };

  return finalizeBlueprint(merged, ctx);
}

export function wizardStackFromBlueprint(blueprint: ProjectBlueprint) {
  return {
    frontendFramework: blueprint.stack.frontend ?? "",
    backendFramework: blueprint.stack.backend ?? "",
    database: blueprint.stack.database ?? "",
    authProvider: blueprint.stack.auth ?? "",
    hostingProvider: blueprint.stack.hosting ?? "",
    fileStorage: blueprint.stack.storage ?? "None",
    paymentProvider: blueprint.stack.payment ?? "None",
  };
}

export function stackPreferencesFromBlueprint(blueprint: ProjectBlueprint) {
  return {
    frontend: blueprint.stack.frontend,
    backend: blueprint.stack.backend,
    database: blueprint.stack.database,
    auth: blueprint.stack.auth,
    hosting: blueprint.stack.hosting,
    storage: blueprint.stack.storage,
    payment: blueprint.stack.payment,
  };
}
