import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { featureRequests } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { dispatchSingleFeatureDocumentGeneration } from "@/lib/mcp-studio/feature-orchestration";
import { featureDocTypeValues } from "@/lib/validators/feature-doc-types";

export const maxDuration = 60;

const schema = z.object({
  featureRequestId: z.string().min(1),
  documentType: z.enum(featureDocTypeValues),
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

  const siteUrl = process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? req.nextUrl.origin;
  const outcome = await dispatchSingleFeatureDocumentGeneration(featureRequestId, documentType, userId, siteUrl);

  if (outcome.status === "generating") return NextResponse.json({ status: "generating" }, { status: 202 });
  if (outcome.status === "generated") return NextResponse.json({ success: true, wordCount: outcome.wordCount });

  console.error("[feature/generate]", outcome.detail);
  return NextResponse.json({ error: "Generation failed", detail: outcome.detail }, { status: 500 });
}
