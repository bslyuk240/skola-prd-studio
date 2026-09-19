import { db } from "@/db";
import { projects, documents } from "@/db/schema";
import { buildBlueprintFromWizard } from "@/lib/blueprint-engine/extract/extract-blueprint-model";
import type { ProjectContext } from "@/lib/ai-prompts";
import { PROJECT_DOCUMENT_DEFINITIONS } from "@/lib/project-document-types";
import type { z } from "zod";
import type { createProjectParams } from "@/lib/validators/mcp-studio";

/** Mirrors POST /api/projects — shared so the wizard UI and the MCP connector stay in sync. */
export async function createProjectFromInput(userId: string, data: z.infer<typeof createProjectParams>) {
  const blueprintSeed = buildBlueprintFromWizard(data as ProjectContext);

  const [project] = await db
    .insert(projects)
    .values({
      userId,
      name: data.appName,
      description: data.shortDescription,
      appType: data.appCategory,
      platform: data.platformType,
      securityLevel: data.securityLevel ?? "standard",
      status: "draft",
      readinessScore: 0,
      securityScore: 0,
      stackPreferences: {
        frontend: data.frontendFramework,
        backend: data.backendFramework,
        database: data.database,
        auth: data.authProvider,
        hosting: data.hostingProvider,
        storage: data.fileStorage,
        payment: data.paymentProvider,
      },
      wizardData: data,
      blueprintModel: blueprintSeed,
    })
    .returning();

  await db.insert(documents).values(
    PROJECT_DOCUMENT_DEFINITIONS.map(({ type, title }) => ({
      projectId: project.id,
      type,
      title,
      status: "pending" as const,
    }))
  );

  return project;
}
