import { db } from "@/db";
import { projects, documents, userPreferences } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { buildPrompt, ProjectContext } from "@/lib/ai-prompts";
import { generateText, DEFAULT_MODEL } from "@/lib/openrouter";
import { calcDocCredits } from "@/lib/credits";
import { enrichPromptWithEie } from "@/lib/eie/prd-connector";

type DocumentType =
  | "prd"
  | "trd"
  | "app_flow"
  | "ux_brief"
  | "backend_schema"
  | "implementation_plan"
  | "security_blueprint";

export async function generateProjectDocument(
  projectId: string,
  documentType: DocumentType,
  userId: string
): Promise<{ wordCount: number }> {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!project) {
    throw new Error("Project not found");
  }

  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.projectId, projectId), eq(documents.type, documentType)))
    .limit(1);

  const [userPrefs] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  const savedModel = userPrefs?.aiModel ?? DEFAULT_MODEL;
  const model =
    savedModel === "google/gemini-2.0-flash-001" ? DEFAULT_MODEL : savedModel;

  const ctx = (project.wizardData ?? {}) as ProjectContext;
  ctx.appName = project.name;
  ctx.shortDescription = project.description ?? "";
  ctx.securityLevel = project.securityLevel ?? "standard";

  const basePrompt = buildPrompt(documentType, ctx);
  const prompt = await enrichPromptWithEie({
    project,
    documentType,
    documentId: doc?.id,
    basePrompt,
  });

  const content = await generateText(prompt, model);
  const wordCount = content.split(/\s+/).length;
  const aiCreditsUsed = calcDocCredits(wordCount);

  await db
    .update(documents)
    .set({
      content,
      wordCount,
      aiCreditsUsed,
      status: "ready",
      version: 1,
      updatedAt: new Date(),
    })
    .where(and(eq(documents.projectId, projectId), eq(documents.type, documentType)));

  const allDocs = await db.select().from(documents).where(eq(documents.projectId, projectId));
  const ready = allDocs.filter((d) => d.status === "ready" || d.status === "approved").length;
  const readinessScore = Math.round((ready / 7) * 100);
  const securityDoc = allDocs.find(
    (d) => d.type === "security_blueprint" && d.status !== "pending"
  );
  const securityScore = securityDoc ? Math.min(100, readinessScore + 20) : readinessScore;

  await db
    .update(projects)
    .set({
      readinessScore,
      securityScore,
      status: ready === 7 ? "review" : "generating",
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId));

  return { wordCount };
}
