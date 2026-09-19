import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, documents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { ensureProjectBlueprint, saveProjectBlueprint } from "@/lib/blueprint-engine/project-blueprint-service";
import { patchBlueprintFromIssues, isResolvableIssue } from "@/lib/blueprint-engine/critic/conflict-resolver";
import { buildIntegrityReport } from "@/lib/blueprint-engine/integrity-report";
import { enforceTerminologyOnContent } from "@/lib/blueprint-engine/validate/enforce-terminology";
import { enforceStackLockInText } from "@/lib/blueprint-engine/validate/stack-lock";
import { projectDocumentTypeSchema, type ProjectDocumentType } from "@/lib/project-document-types";

const fixDocumentSchema = z.object({
  documentType: projectDocumentTypeSchema.nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = fixDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { documentType } = parsed.data;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const blueprint = await ensureProjectBlueprint(project);
  if (!blueprint) {
    return NextResponse.json({ error: "Blueprint model not built yet" }, { status: 404 });
  }

  const projectDocs = await db
    .select()
    .from(documents)
    .where(eq(documents.projectId, projectId));

  const snapshots = projectDocs
    .filter((doc) => doc.content)
    .map((doc) => ({ type: doc.type, content: doc.content! }));

  const currentReport = buildIntegrityReport(blueprint, snapshots);
  const fixable = currentReport.issues.filter(
    (issue) =>
      issue.severity === "error" &&
      isResolvableIssue(issue) &&
      (documentType ? issue.documentTypes.includes(documentType) : issue.documentTypes.length === 0)
  );

  if (fixable.length === 0) {
    return NextResponse.json(
      { error: "Nothing to auto-fix here. Edit the affected document instead." },
      { status: 409 }
    );
  }

  const { blueprint: patchedBlueprint, resolvedIssueIds } = patchBlueprintFromIssues(
    blueprint,
    fixable,
    snapshots
  );

  if (documentType) {
    const targetDoc = projectDocs.find((doc) => doc.type === documentType);
    if (targetDoc?.content) {
      const terminology = enforceTerminologyOnContent(patchedBlueprint, targetDoc.content, documentType);
      const nextContent = enforceStackLockInText(terminology.content, patchedBlueprint);

      if (nextContent !== targetDoc.content) {
        await db
          .update(documents)
          .set({
            content: nextContent,
            wordCount: nextContent.split(/\s+/).length,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(documents.projectId, projectId),
              eq(documents.type, documentType as ProjectDocumentType)
            )
          );
      }
    }
  }

  const updatedDocs = await db
    .select()
    .from(documents)
    .where(eq(documents.projectId, projectId));
  const updatedSnapshots = updatedDocs
    .filter((doc) => doc.content)
    .map((doc) => ({ type: doc.type, content: doc.content! }));

  const report = buildIntegrityReport(patchedBlueprint, updatedSnapshots);
  await saveProjectBlueprint(projectId, patchedBlueprint, report.breakdown);

  const remainingIssueIds = fixable
    .map((issue) => issue.id)
    .filter((id) => !resolvedIssueIds.includes(id));

  return NextResponse.json({
    success: true,
    patchedCount: resolvedIssueIds.length,
    remainingIssueIds,
    report,
  });
}
