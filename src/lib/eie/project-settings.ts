import type { Project } from "@/db/schema";
import type { ProjectContext } from "@/lib/ai-prompts";

export function isEieEnabledForProject(project: Project): boolean {
  const wizard = (project.wizardData ?? {}) as ProjectContext & {
    enableEieCrossReferencing?: boolean;
  };
  return wizard.enableEieCrossReferencing !== false;
}

export function mergeProjectWizardData(
  current: unknown,
  patch: { enableEieCrossReferencing?: boolean }
): Record<string, unknown> {
  return {
    ...((current ?? {}) as Record<string, unknown>),
    ...patch,
  };
}
