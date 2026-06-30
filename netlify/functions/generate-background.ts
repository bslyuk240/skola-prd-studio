// Netlify Background Function — runs with up to 15 minutes execution time,
// well beyond the ~10-26s limit on regular synchronous functions. Triggered
// by /api/generate, which returns to the client immediately while this runs.
// Relative imports only — this is bundled separately from the Next.js app
// and does not resolve the "@/" tsconfig path alias.
import { db } from "../../src/db";
import { projects, documents, userPreferences } from "../../src/db/schema";
import { eq, and } from "drizzle-orm";
import { buildPrompt, ProjectContext } from "../../src/lib/ai-prompts";
import { generateText, DEFAULT_MODEL } from "../../src/lib/openrouter";
import { calcDocCredits } from "../../src/lib/credits";

interface Event {
  body?: string | null;
}

export const handler = async (event: Event) => {
  let projectId = "";
  let documentType = "";

  try {
    const payload = JSON.parse(event.body ?? "{}");
    projectId = payload.projectId;
    documentType = payload.documentType;
    const userId = payload.userId;

    if (!projectId || !documentType || !userId) {
      return { statusCode: 400, body: "Missing required fields" };
    }

    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);
    if (!project) return { statusCode: 404, body: "Project not found" };

    const [userPrefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
    const savedModel = userPrefs?.aiModel ?? DEFAULT_MODEL;
    const model = savedModel === "google/gemini-2.0-flash-001" ? DEFAULT_MODEL : savedModel;

    const ctx = (project.wizardData ?? {}) as ProjectContext;
    ctx.appName = project.name;
    ctx.shortDescription = project.description ?? "";
    ctx.securityLevel = project.securityLevel ?? "standard";

    const prompt = buildPrompt(documentType, ctx);
    const content = await generateText(prompt, model);
    const wordCount = content.split(/\s+/).length;
    const aiCreditsUsed = calcDocCredits(wordCount);

    await db
      .update(documents)
      .set({ content, wordCount, aiCreditsUsed, status: "ready", version: 1, updatedAt: new Date() })
      .where(and(eq(documents.projectId, projectId), eq(documents.type, documentType as typeof documents.$inferSelect["type"])));

    const allDocs = await db.select().from(documents).where(eq(documents.projectId, projectId));
    const ready = allDocs.filter((d) => d.status === "ready" || d.status === "approved").length;
    const readinessScore = Math.round((ready / 7) * 100);
    const securityDoc = allDocs.find((d) => d.type === "security_blueprint" && d.status !== "pending");
    const securityScore = securityDoc ? Math.min(100, readinessScore + 20) : readinessScore;

    await db
      .update(projects)
      .set({ readinessScore, securityScore, status: ready === 7 ? "review" : "generating", updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    return { statusCode: 200, body: "ok" };
  } catch (err) {
    console.error("[generate-background]", err);
    if (projectId && documentType) {
      try {
        await db
          .update(documents)
          .set({ status: "pending", updatedAt: new Date() })
          .where(and(eq(documents.projectId, projectId), eq(documents.type, documentType as typeof documents.$inferSelect["type"])));
      } catch (revertErr) {
        console.error("[generate-background] failed to revert status", revertErr);
      }
    }
    return { statusCode: 500, body: "Generation failed" };
  }
};
