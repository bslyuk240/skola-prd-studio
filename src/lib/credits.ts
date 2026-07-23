import { db } from "@/db";
import { projects, documents, featureRequests, featureDocuments, securityScans, eieKnowledgeSources, userPreferences } from "@/db/schema";
import { eq, inArray, sum } from "drizzle-orm";

// Fallback used until a user has a saved preference row.
export const DEFAULT_CREDIT_LIMIT = 2000;

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
    eieIngestion: number;
  };
}

export async function getUserCreditLimit(userId: string): Promise<number> {
  const [row] = await db
    .select({ creditLimit: userPreferences.creditLimit })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  return row?.creditLimit ?? DEFAULT_CREDIT_LIMIT;
}

export async function getUserCreditStatus(userId: string): Promise<CreditStatus> {
  const limit = await getUserCreditLimit(userId);

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

  const [eieRow] = await db
    .select({ total: sum(eieKnowledgeSources.aiCreditsUsed) })
    .from(eieKnowledgeSources)
    .where(eq(eieKnowledgeSources.createdBy, userId));
  const eieIngestion = Number(eieRow?.total ?? 0);

  const consumed = blueprintDocs + featureDocs + securityScansTotal + eieIngestion;
  const remaining = Math.max(0, limit - consumed);
  const percentage = limit > 0 ? Math.min(100, Math.round((consumed / limit) * 100)) : 100;

  return {
    consumed,
    limit,
    remaining,
    percentage,
    breakdown: {
      blueprintDocs,
      featureDocs,
      securityScans: securityScansTotal,
      eieIngestion,
    },
  };
}
