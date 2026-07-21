import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, documents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { generateProjectDocument } from "@/lib/generate-project-document";
import { triggerBackground } from "@/lib/trigger-background";

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
  // without `netlify dev`). Use Netlify's own canonical site URL rather than
  // req.nextUrl.origin, which can resolve to an internal/edge address.
  const siteUrl = process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? req.nextUrl.origin;
  const dispatched = await triggerBackground(`${siteUrl}/.netlify/functions/generate-background`, {
    projectId,
    documentType,
    userId,
  });
  if (dispatched) {
    return NextResponse.json({ status: "generating" }, { status: 202 });
  }

  try {
    const { wordCount } = await generateProjectDocument(projectId, documentType, userId);
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
