import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, documents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { ensureProjectBlueprint, saveProjectBlueprint } from "@/lib/blueprint-engine/project-blueprint-service";
import { patchBlueprintFromIssues } from "@/lib/blueprint-engine/critic/conflict-resolver";
import { buildIntegrityReport } from "@/lib/blueprint-engine/integrity-report";

const acceptSchema = z.object({
  issueId: z.string().min(1),
  optionId: z.string().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const blueprint = await ensureProjectBlueprint(project);
  const projectDocs = await db
    .select()
    .from(documents)
    .where(eq(documents.projectId, projectId));

  const snapshots = projectDocs
    .filter((doc) => doc.content)
    .map((doc) => ({ type: doc.type, content: doc.content! }));

  const report = buildIntegrityReport(blueprint, snapshots);

  return NextResponse.json({
    report,
    documents: projectDocs.map((doc) => ({ id: doc.id, type: doc.type, status: doc.status })),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

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
  const issue = currentReport.issues.find((item) => item.id === parsed.data.issueId);

  if (!issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  const { blueprint: patchedBlueprint, patches } = patchBlueprintFromIssues(
    blueprint,
    [issue],
    snapshots,
    { [issue.id]: parsed.data.optionId ?? "default" }
  );

  if (patches.length === 0) {
    return NextResponse.json(
      { error: "This issue cannot be auto-resolved. Edit the affected document instead." },
      { status: 409 }
    );
  }

  const report = buildIntegrityReport(patchedBlueprint, snapshots);
  await saveProjectBlueprint(projectId, patchedBlueprint, report.breakdown);

  return NextResponse.json({
    success: true,
    patches,
    report,
  });
}
