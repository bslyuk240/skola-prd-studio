import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { featureRequests, featureDocuments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { triggerBackground } from "@/lib/trigger-background";
import {
  generateFeatureDocument,
  type FeatureDocumentType,
} from "@/lib/generate-feature-document";

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

  await db
    .update(featureDocuments)
    .set({ status: "generating", updatedAt: new Date() })
    .where(
      and(
        eq(featureDocuments.featureRequestId, featureRequestId),
        eq(featureDocuments.type, documentType)
      )
    );

  const siteUrl = process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? req.nextUrl.origin;
  const dispatched = await triggerBackground(`${siteUrl}/.netlify/functions/feature-generate-background`, {
    featureRequestId,
    documentType,
    userId,
  });
  if (dispatched) {
    return NextResponse.json({ status: "generating" }, { status: 202 });
  }

  try {
    const result = await generateFeatureDocument(
      featureRequestId,
      documentType as FeatureDocumentType,
      userId
    );
    return NextResponse.json({ success: true, wordCount: result.wordCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[feature/generate]", message);
    await db
      .update(featureDocuments)
      .set({ status: "pending", updatedAt: new Date() })
      .where(
        and(
          eq(featureDocuments.featureRequestId, featureRequestId),
          eq(featureDocuments.type, documentType)
        )
      );
    return NextResponse.json({ error: "Generation failed", detail: message }, { status: 500 });
  }
}
