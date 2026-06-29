import { db } from "@/db";
import { projects, documents, featureRequests, featureDocuments, securityScans } from "@/db/schema";
import { eq, inArray, sum } from "drizzle-orm";

export const CREDIT_LIMIT = 1000;

// Credits = flat 10 + 1 per 100 words
export function calcDocCredits(wordCount: number): number {
  return 10 + Math.floor(wordCount / 100);
}

// Feature docs are lighter — flat 8 + 1 per 100 words
export function calcFeatureDocCredits(wordCount: number): number {
  return 8 + Math.floor(wordCount / 100);
}

// Security scan is a flat rate
export const SECURITY_SCAN_CREDITS = 25;

export interface CreditStatus {
  consumed: number;
  limit: number;
  remaining: number;
  percentage: number;
  breakdown: {
    blueprintDocs: number;
    featureDocs: number;
    securityScans: number;
  };
}

export async function getUserCreditStatus(userId: string): Promise<CreditStatus> {
  // Get user's project IDs
  const userProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.userId, userId));

  const projectIds = userProjects.map((p) => p.id);

  // Get user's feature request IDs
  const userRequests = await db
    .select({ id: featureRequests.id })
    .from(featureRequests)
    .where(eq(featureRequests.userId, userId));

  const requestIds = userRequests.map((r) => r.id);

  // Sum blueprint doc credits
  let blueprintDocs = 0;
  if (projectIds.length > 0) {
    const [row] = await db
      .select({ total: sum(documents.aiCreditsUsed) })
      .from(documents)
      .where(inArray(documents.projectId, projectIds));
    blueprintDocs = Number(row?.total ?? 0);
  }

  // Sum feature doc credits
  let featureDocs = 0;
  if (requestIds.length > 0) {
    const [row] = await db
      .select({ total: sum(featureDocuments.aiCreditsUsed) })
      .from(featureDocuments)
      .where(inArray(featureDocuments.featureRequestId, requestIds));
    featureDocs = Number(row?.total ?? 0);
  }

  // Sum security scan credits
  const [scanRow] = await db
    .select({ total: sum(securityScans.aiCreditsUsed) })
    .from(securityScans)
    .where(eq(securityScans.userId, userId));
  const securityScansTotal = Number(scanRow?.total ?? 0);

  const consumed = blueprintDocs + featureDocs + securityScansTotal;
  const remaining = Math.max(0, CREDIT_LIMIT - consumed);
  const percentage = Math.min(100, Math.round((consumed / CREDIT_LIMIT) * 100));

  return {
    consumed,
    limit: CREDIT_LIMIT,
    remaining,
    percentage,
    breakdown: {
      blueprintDocs,
      featureDocs,
      securityScans: securityScansTotal,
    },
  };
}
