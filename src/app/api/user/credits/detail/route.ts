import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects, documents, featureRequests, featureDocuments, securityScans, eieKnowledgeSources } from "@/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { CREDIT_LIMIT } from "@/lib/credits";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const userProjects = await db.select().from(projects).where(eq(projects.userId, userId));
    const projectIds = userProjects.map((p) => p.id);

    const allDocs = projectIds.length
      ? await db.select().from(documents).where(inArray(documents.projectId, projectIds)).orderBy(desc(documents.updatedAt))
      : [];

    const userRequests = await db.select().from(featureRequests).where(eq(featureRequests.userId, userId));
    const requestIds = userRequests.map((r) => r.id);

    const allFeatureDocs = requestIds.length
      ? await db.select().from(featureDocuments).where(inArray(featureDocuments.featureRequestId, requestIds)).orderBy(desc(featureDocuments.updatedAt))
      : [];

    const allScans = await db
      .select()
      .from(securityScans)
      .where(eq(securityScans.userId, userId))
      .orderBy(desc(securityScans.createdAt));

    const allEieSources = await db
      .select()
      .from(eieKnowledgeSources)
      .where(eq(eieKnowledgeSources.createdBy, userId))
      .orderBy(desc(eieKnowledgeSources.updatedAt));

    const blueprintCredits = allDocs.reduce((s, d) => s + (d.aiCreditsUsed ?? 0), 0);
    const featureCredits = allFeatureDocs.reduce((s, d) => s + (d.aiCreditsUsed ?? 0), 0);
    const securityCredits = allScans.reduce((s, s2) => s + (s2.aiCreditsUsed ?? 0), 0);
    const eieCredits = allEieSources.reduce((s, source) => s + (source.aiCreditsUsed ?? 0), 0);
    const totalConsumed = blueprintCredits + featureCredits + securityCredits + eieCredits;
    const percentage = Math.min(100, Math.round((totalConsumed / CREDIT_LIMIT) * 100));
    const remaining = Math.max(0, CREDIT_LIMIT - totalConsumed);

    const projectMap = Object.fromEntries(userProjects.map((p) => [p.id, p.name]));
    const requestMap = Object.fromEntries(userRequests.map((r) => [r.id, r.featureName]));

    return NextResponse.json({
      totalConsumed,
      limit: CREDIT_LIMIT,
      remaining,
      percentage,
      breakdown: { blueprintCredits, featureCredits, securityCredits, eieCredits },
      blueprintDocs: allDocs
        .filter((d) => (d.aiCreditsUsed ?? 0) > 0)
        .slice(0, 30)
        .map((d) => ({
          id: d.id,
          type: d.type,
          projectName: projectMap[d.projectId] ?? "Project",
          wordCount: d.wordCount,
          aiCreditsUsed: d.aiCreditsUsed,
        })),
      featureDocs: allFeatureDocs
        .filter((d) => (d.aiCreditsUsed ?? 0) > 0)
        .slice(0, 30)
        .map((d) => ({
          id: d.id,
          type: d.type,
          featureName: requestMap[d.featureRequestId] ?? "Feature",
          wordCount: d.wordCount,
          aiCreditsUsed: d.aiCreditsUsed,
        })),
      scans: allScans
        .filter((s) => (s.aiCreditsUsed ?? 0) > 0)
        .map((s) => ({
          id: s.id,
          provider: s.provider,
          repoOwner: s.repoOwner,
          repoName: s.repoName,
          safeToShipScore: s.safeToShipScore,
          aiCreditsUsed: s.aiCreditsUsed,
        })),
      eieSources: allEieSources
        .filter((source) => (source.aiCreditsUsed ?? 0) > 0)
        .slice(0, 30)
        .map((source) => ({
          id: source.id,
          name: source.name,
          sourceType: source.sourceType,
          status: source.status,
          aiCreditsUsed: source.aiCreditsUsed,
          updatedAt: source.updatedAt,
        })),
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch credit detail" }, { status: 500 });
  }
}
