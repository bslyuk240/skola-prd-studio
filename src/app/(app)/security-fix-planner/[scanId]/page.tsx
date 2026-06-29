import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { securityScans, securityFindings } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { SecurityReportClient } from "@/components/security-planner/security-report-client";

interface Props {
  params: Promise<{ scanId: string }>;
}

export default async function SecurityReportPage({ params }: Props) {
  const { scanId } = await params;
  const { userId } = await auth();
  if (!userId) return null;

  const [scan] = await db
    .select()
    .from(securityScans)
    .where(and(eq(securityScans.id, scanId), eq(securityScans.userId, userId)))
    .limit(1);
  if (!scan) notFound();

  const findings = await db
    .select()
    .from(securityFindings)
    .where(eq(securityFindings.scanId, scanId));

  return <SecurityReportClient scan={scan} findings={findings} />;
}
