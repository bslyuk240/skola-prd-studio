// Netlify Background Function for Feature Planner document generation.
// See generate-background.ts for the rationale. Relative imports only.
import { db } from "../../src/db";
import { featureRequests, featureDocuments, repoConnections, userPreferences } from "../../src/db/schema";
import { eq, and } from "drizzle-orm";
import { buildFeaturePrompt, FeatureContext } from "../../src/lib/feature-prompts";
import { generateText, DEFAULT_MODEL } from "../../src/lib/openrouter";
import { calcFeatureDocCredits } from "../../src/lib/credits";

interface Event {
  body?: string | null;
}

export const handler = async (event: Event) => {
  let featureRequestId = "";
  let documentType = "";

  try {
    const payload = JSON.parse(event.body ?? "{}");
    featureRequestId = payload.featureRequestId;
    documentType = payload.documentType;
    const userId = payload.userId;

    if (!featureRequestId || !documentType || !userId) {
      return { statusCode: 400, body: "Missing required fields" };
    }

    const [request] = await db
      .select()
      .from(featureRequests)
      .where(and(eq(featureRequests.id, featureRequestId), eq(featureRequests.userId, userId)))
      .limit(1);
    if (!request) return { statusCode: 404, body: "Not found" };

    let repoConn = null;
    if (request.repoConnectionId) {
      const [conn] = await db.select().from(repoConnections).where(eq(repoConnections.id, request.repoConnectionId)).limit(1);
      repoConn = conn;
    }

    const [userPrefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
    const savedModel = userPrefs?.aiModel ?? DEFAULT_MODEL;
    const model = savedModel === "google/gemini-2.0-flash-001" ? DEFAULT_MODEL : savedModel;

    const keyFiles = (repoConn?.keyFilesContent as Record<string, string>) ?? {};
    const keyFilesContext = Object.entries(keyFiles)
      .map(([f, c]) => `--- ${f} ---\n${c}`)
      .join("\n")
      .slice(0, 5000);

    const ctx: FeatureContext = {
      featureName: request.featureName,
      featureDescription: request.featureDescription,
      affectedRoles: request.affectedRoles ?? undefined,
      affectsPermissions: request.affectsPermissions ?? false,
      needsNewTables: request.needsNewTables ?? false,
      needsNotifications: request.needsNotifications ?? false,
      affectsDashboard: request.affectsDashboard ?? false,
      mobileRequired: request.mobileRequired ?? false,
      affectsBilling: request.affectsBilling ?? false,
      scopeLevel: request.scopeLevel ?? "mvp",
      additionalContext: request.additionalContext ?? undefined,
      detectedStack: (repoConn?.detectedStack as FeatureContext["detectedStack"]) ?? undefined,
      projectSummary: repoConn?.projectSummary ?? undefined,
      keyFilesContext,
    };

    const prompt = buildFeaturePrompt(documentType, ctx);
    const content = await generateText(prompt, model);
    const wordCount = content.split(/\s+/).length;
    const aiCreditsUsed = calcFeatureDocCredits(wordCount);

    await db
      .update(featureDocuments)
      .set({ content, wordCount, aiCreditsUsed, status: "ready", updatedAt: new Date() })
      .where(and(eq(featureDocuments.featureRequestId, featureRequestId), eq(featureDocuments.type, documentType as typeof featureDocuments.$inferSelect["type"])));

    return { statusCode: 200, body: "ok" };
  } catch (err) {
    console.error("[feature-generate-background]", err);
    if (featureRequestId && documentType) {
      try {
        await db
          .update(featureDocuments)
          .set({ status: "pending", updatedAt: new Date() })
          .where(and(eq(featureDocuments.featureRequestId, featureRequestId), eq(featureDocuments.type, documentType as typeof featureDocuments.$inferSelect["type"])));
      } catch (revertErr) {
        console.error("[feature-generate-background] failed to revert status", revertErr);
      }
    }
    return { statusCode: 500, body: "Generation failed" };
  }
};
