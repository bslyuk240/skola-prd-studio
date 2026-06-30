import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { featureRequests, featureDocuments, repoConnections, userPreferences } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { buildFeaturePrompt, FeatureContext } from "@/lib/feature-prompts";
import { generateText, DEFAULT_MODEL } from "@/lib/openrouter";
import { calcFeatureDocCredits } from "@/lib/credits";
import { z } from "zod";

export const maxDuration = 60;

const schema = z.object({
  featureRequestId: z.string().min(1),
  documentType: z.enum([
    "feature_prd",
    "impact_analysis",
    "schema_changes",
    "api_changes",
    "ui_changes",
    "security_checklist",
    "implementation_tasks",
    "test_plan",
    "deployment_plan",
  ]),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { featureRequestId, documentType } = parsed.data;

  const [request] = await db
    .select()
    .from(featureRequests)
    .where(and(eq(featureRequests.id, featureRequestId), eq(featureRequests.userId, userId)))
    .limit(1);
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Mark generating
  await db.update(featureDocuments)
    .set({ status: "generating", updatedAt: new Date() })
    .where(and(eq(featureDocuments.featureRequestId, featureRequestId), eq(featureDocuments.type, documentType)));

  try {
    // Load repo connection context
    let repoConn = null;
    if (request.repoConnectionId) {
      const [conn] = await db.select().from(repoConnections).where(eq(repoConnections.id, request.repoConnectionId)).limit(1);
      repoConn = conn;
    }

    // Load user's model preference
    const [userPrefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
    const savedModel = userPrefs?.aiModel ?? DEFAULT_MODEL;
    const model = savedModel === "google/gemini-2.0-flash-001" ? DEFAULT_MODEL : savedModel;

    // Build feature context
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
      modules: (repoConn?.fileTree as { path: string }[] | null)
        ? undefined
        : undefined,
      keyFilesContext,
    };

    const prompt = buildFeaturePrompt(documentType, ctx);
    const content = await generateText(prompt, model);
    const wordCount = content.split(/\s+/).length;
    const aiCreditsUsed = calcFeatureDocCredits(wordCount);

    await db.update(featureDocuments).set({
      content,
      wordCount,
      aiCreditsUsed,
      status: "ready",
      updatedAt: new Date(),
    }).where(and(eq(featureDocuments.featureRequestId, featureRequestId), eq(featureDocuments.type, documentType)));

    return NextResponse.json({ success: true, wordCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[feature/generate]", message);
    await db.update(featureDocuments).set({ status: "pending", updatedAt: new Date() })
      .where(and(eq(featureDocuments.featureRequestId, featureRequestId), eq(featureDocuments.type, documentType)));
    return NextResponse.json({ error: "Generation failed", detail: message }, { status: 500 });
  }
}
