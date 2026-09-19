import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { dispatchSingleDocumentGeneration } from "@/lib/mcp-studio/document-orchestration";
import { projectDocumentTypeSchema } from "@/lib/project-document-types";

export const maxDuration = 60;

const schema = z.object({
  projectId: z.string().min(1),
  documentType: projectDocumentTypeSchema,
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { projectId, documentType } = parsed.data;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const siteUrl = process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? req.nextUrl.origin;
  const outcome = await dispatchSingleDocumentGeneration(project, documentType, userId, siteUrl, {
    autoApproveBlueprint: false,
  });

  if (outcome.status === "blocked") {
    return NextResponse.json(
      { error: "Approve the architecture model before generating documents", code: outcome.code },
      { status: 403 }
    );
  }
  if (outcome.status === "generating") return NextResponse.json({ status: "generating" }, { status: 202 });
  if (outcome.status === "generated") return NextResponse.json({ success: true, wordCount: outcome.wordCount });

  console.error("[generate] Error:", outcome.detail);
  return NextResponse.json({ error: "Generation failed", detail: outcome.detail }, { status: 500 });
}
