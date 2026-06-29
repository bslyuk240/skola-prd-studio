import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { featureRequests, featureDocuments } from "@/db/schema";
import { z } from "zod";

const FEATURE_DOC_TYPES = [
  { type: "feature_prd" as const, title: "Feature Requirements Document" },
  { type: "impact_analysis" as const, title: "Impact Analysis" },
  { type: "schema_changes" as const, title: "Schema & API Changes" },
  { type: "api_changes" as const, title: "API Changes" },
  { type: "ui_changes" as const, title: "UI Change Plan" },
  { type: "security_checklist" as const, title: "Security Impact Checklist" },
  { type: "implementation_tasks" as const, title: "Implementation Tasks" },
  { type: "test_plan" as const, title: "Test Plan" },
  { type: "deployment_plan" as const, title: "Deployment & Rollback Plan" },
];

const schema = z.object({
  repoConnectionId: z.string().optional(),
  featureName: z.string().min(1),
  featureDescription: z.string().min(1),
  affectedRoles: z.string().optional(),
  affectsPermissions: z.boolean().optional(),
  needsNewTables: z.boolean().optional(),
  needsNotifications: z.boolean().optional(),
  affectsDashboard: z.boolean().optional(),
  mobileRequired: z.boolean().optional(),
  affectsBilling: z.boolean().optional(),
  scopeLevel: z.enum(["mvp", "full"]).optional(),
  additionalContext: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const [request] = await db.insert(featureRequests).values({
    userId,
    ...parsed.data,
    status: "draft",
  }).returning();

  // Create placeholder feature documents
  await db.insert(featureDocuments).values(
    FEATURE_DOC_TYPES.map(({ type, title }) => ({
      featureRequestId: request.id,
      type,
      title,
      status: "pending" as const,
    }))
  );

  return NextResponse.json({ requestId: request.id });
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

import { eq } from "drizzle-orm";
import { desc } from "drizzle-orm";
