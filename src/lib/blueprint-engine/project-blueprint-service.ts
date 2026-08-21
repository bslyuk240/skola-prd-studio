import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { ProjectContext } from "@/lib/ai-prompts";
import {
  projectBlueprintSchema,
  type ProjectBlueprint,
} from "@/lib/zod/blueprint-schemas";
import { buildBlueprintFromWizard } from "@/lib/blueprint-engine/extract/extract-blueprint-model";
import { extractBlueprintModel } from "@/lib/blueprint-engine/extract/extract-blueprint-model";
import { finalizeBlueprint } from "@/lib/blueprint-engine/plan/finalize-blueprint";
import type { ReadinessBreakdown } from "@/lib/blueprint-engine/validate/readiness";

function projectContextFromRow(project: typeof projects.$inferSelect): ProjectContext {
  const ctx = (project.wizardData ?? {}) as ProjectContext;
  ctx.appName = project.name;
  ctx.shortDescription = project.description ?? "";
  ctx.securityLevel = project.securityLevel ?? "standard";
  return ctx;
}

function parseStoredBlueprint(value: unknown): ProjectBlueprint | null {
  const parsed = projectBlueprintSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function getProjectBlueprint(
  project: typeof projects.$inferSelect
): Promise<ProjectBlueprint | null> {
  return parseStoredBlueprint(project.blueprintModel);
}

export async function saveProjectBlueprint(
  projectId: string,
  blueprint: ProjectBlueprint,
  readinessBreakdown?: ReadinessBreakdown
): Promise<void> {
  const validated = projectBlueprintSchema.parse(blueprint);
  await db
    .update(projects)
    .set({
      blueprintModel: validated,
      ...(readinessBreakdown ? { readinessBreakdown } : {}),
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId));
}

type EnsureOptions = {
  enrichWithLlm?: boolean;
  model?: string;
};

/** Load persisted blueprint or build (and optionally LLM-enrich) then persist. */
export async function ensureProjectBlueprint(
  project: typeof projects.$inferSelect,
  options: EnsureOptions = {}
): Promise<ProjectBlueprint> {
  const existing = parseStoredBlueprint(project.blueprintModel);
  const ctx = projectContextFromRow(project);

  if (existing && !options.enrichWithLlm) {
    const finalized = finalizeBlueprint(existing, ctx);
    await saveProjectBlueprint(project.id, finalized);
    return finalized;
  }

  const blueprint = options.enrichWithLlm
    ? finalizeBlueprint(await extractBlueprintModel(ctx, options.model), ctx)
    : finalizeBlueprint(buildBlueprintFromWizard(ctx), ctx);

  await saveProjectBlueprint(project.id, blueprint);
  return blueprint;
}

export async function ensureProjectBlueprintById(
  projectId: string,
  userId: string,
  options?: EnsureOptions
): Promise<ProjectBlueprint> {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project || project.userId !== userId) {
    throw new Error("Project not found");
  }

  return ensureProjectBlueprint(project, options);
}
