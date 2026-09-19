import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { featureRequests } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requestFeatureFromInput } from "@/lib/mcp-studio/request-feature";
import { requestFeatureParams } from "@/lib/validators/mcp-studio";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = requestFeatureParams.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const outcome = await requestFeatureFromInput(userId, parsed.data);
  if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });

  return NextResponse.json({ requestId: outcome.requestId });
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requests = await db
    .select()
    .from(featureRequests)
    .where(eq(featureRequests.userId, userId))
    .orderBy(desc(featureRequests.createdAt));

  return NextResponse.json(requests);
}
