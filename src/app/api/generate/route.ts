import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, documents, userPreferences } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { buildPrompt, ProjectContext } from "@/lib/ai-prompts";
import { generateText, DEFAULT_MODEL } from "@/lib/openrouter";
import { calcDocCredits } from "@/lib/credits";
import { z } from "zod";

export const maxDuration = 60;

const schema = z.object({
  projectId: z.string().min(1),
  documentType: z.enum(["prd", "trd", "app_flow", "ux_brief", "backend_schema", "implementation_plan", "security_blueprint"]),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { projectId, documentType } = parsed.data;

  // Verify ownership
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Mark document as generating
  await db
    .update(documents)
    .set({ status: "generating", updatedAt: new Date() })
    .where(and(eq(documents.projectId, projectId), eq(documents.type, documentType)));

  // Hand off to a Netlify Background Function (15 min limit) so generation
  // isn't bound by the ~10-26s sync function timeout. Falls back to running
  // inline below when no background function is reachable (e.g. local dev
  // without `netlify dev`).
  try {
    const bgRes = await fetch(`${req.nextUrl.origin}/.netlify/functions/generate-background`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, documentType, userId }),
    });
    if (bgRes.ok || bgRes.status === 202) {
      return NextResponse.json({ status: "generating" }, { status: 202 });
    }
  } catch {
    // Background function unreachable — fall through to inline generation.
  }

  try {
    // Load user's saved model preference
    const [userPrefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);
    // Fallback: migrate old invalid model IDs
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
      .set({
        content,
        wordCount,
        aiCreditsUsed,
        status: "ready",
        version: 1,
        updatedAt: new Date(),
      })
      .where(and(eq(documents.projectId, projectId), eq(documents.type, documentType)));

    // Recalculate readiness score
    const allDocs = await db.select().from(documents).where(eq(documents.projectId, projectId));
    const ready = allDocs.filter((d) => d.status === "ready" || d.status === "approved").length;
    const readinessScore = Math.round((ready / 7) * 100);

    const securityDoc = allDocs.find((d) => d.type === "security_blueprint" && d.status !== "pending");
    const securityScore = securityDoc ? Math.min(100, readinessScore + 20) : readinessScore;

    await db
      .update(projects)
      .set({ readinessScore, securityScore, status: ready === 7 ? "review" : "generating", updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    return NextResponse.json({ success: true, wordCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[generate] Error:", message, err);

    await db
      .update(documents)
      .set({ status: "pending", updatedAt: new Date() })
      .where(and(eq(documents.projectId, projectId), eq(documents.type, documentType)));

    return NextResponse.json({ error: "Generation failed", detail: message }, { status: 500 });
  }
}
