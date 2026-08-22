import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects, documents, securityChecks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { DocumentsClient } from "@/components/documents/documents-client";
import { revertStaleBlueprintDocs, repairInterruptedBlueprintDocs } from "@/lib/generation-status";
import { getProjectBlueprint, ensureProjectBlueprint } from "@/lib/blueprint-engine/project-blueprint-service";
import { buildIntegrityReport } from "@/lib/blueprint-engine/integrity-report";
import { isBlueprintModelApproved } from "@/lib/blueprint-engine/apply-architecture-resolution";
import {
  countSecurityTodosFromWizard,
  mergeSecurityTodoCounts,
} from "@/lib/blueprint-engine/security-todo-scoring";

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function DocumentsPage({ params }: Props) {
  const { projectId } = await params;
  const { userId } = await auth();
  if (!userId) return null;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!project) notFound();

  await revertStaleBlueprintDocs(projectId);
  await repairInterruptedBlueprintDocs(projectId);

  const docs = await db.select().from(documents).where(eq(documents.projectId, projectId));

  let blueprint = await getProjectBlueprint(project);
  if (!blueprint) {
    blueprint = await ensureProjectBlueprint(project);
  }

  if (!isBlueprintModelApproved(blueprint, docs)) {
    redirect(`/projects/${projectId}/resolve`);
  }

  const snapshots = docs.map((doc) => ({
    type: doc.type,
    content: doc.content ?? "",
    status: doc.status,
  }));

  const securityCheckRows = await db
    .select()
    .from(securityChecks)
    .where(eq(securityChecks.projectId, projectId));
  const securityTodoCounts = mergeSecurityTodoCounts(
    {
      openSecurityTodos: securityCheckRows.filter(
        (check) => check.status === "pending" || check.status === "needs_review"
      ).length,
      totalSecurityTodos: securityCheckRows.length,
    },
    countSecurityTodosFromWizard(project.wizardData)
  );

  const integrityReport = buildIntegrityReport(blueprint, snapshots, securityTodoCounts);

  await db
    .update(projects)
    .set({
      ...(integrityReport.breakdown.overall != null
        ? { readinessScore: integrityReport.breakdown.overall }
        : {}),
      securityScore: integrityReport.breakdown.security ?? project.securityScore ?? 0,
      readinessBreakdown: integrityReport.breakdown,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId));

  return (
    <DocumentsClient project={project} documents={docs} integrityReport={integrityReport} />
  );
}
