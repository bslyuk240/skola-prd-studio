import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { featureRequests, featureDocuments } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const featureRequestId = req.nextUrl.searchParams.get("featureRequestId");
  const documentType = req.nextUrl.searchParams.get("documentType");
  if (!featureRequestId || !documentType) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  const [request] = await db
    .select()
    .from(featureRequests)
    .where(and(eq(featureRequests.id, featureRequestId), eq(featureRequests.userId, userId)))
    .limit(1);
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [doc] = await db
    .select()
    .from(featureDocuments)
    .where(and(eq(featureDocuments.featureRequestId, featureRequestId), eq(featureDocuments.type, documentType as typeof featureDocuments.$inferSelect["type"])))
    .limit(1);

  return NextResponse.json({
    status: doc?.status ?? "pending",
    wordCount: doc?.wordCount ?? 0,
  });
}
