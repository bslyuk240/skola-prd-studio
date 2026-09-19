import { db } from "@/db";
import { projects, documents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateProjectDocument } from "@/lib/generate-project-document";
import { triggerBackgroundWithResult } from "@/lib/trigger-background";
import {
  getProjectBlueprint,
  ensureProjectBlueprint,
  saveProjectBlueprint,
} from "@/lib/blueprint-engine/project-blueprint-service";
import {
  isBlueprintModelApproved,
  approveBlueprintModel,
  stackPreferencesFromBlueprint,
  wizardStackFromBlueprint,
} from "@/lib/blueprint-engine/apply-architecture-resolution";
import type { ProjectDocumentType } from "@/lib/project-document-types";

type Project = typeof projects.$inferSelect;

/**
 * MCP callers have no separate "approve architecture" step in the UI, so
 * generation auto-approves the blueprint as-is on first use (same effect as
 * clicking "Approve" with no stack overrides in the app).
 */
async function ensureBlueprintApproved(project: Project) {
  let blueprint = await getProjectBlueprint(project);
  if (!blueprint) blueprint = await ensureProjectBlueprint(project);

  const projectDocs = await db.select().from(documents).where(eq(documents.projectId, project.id));
  if (isBlueprintModelApproved(blueprint, projectDocs)) return blueprint;

  const approvedBlueprint = approveBlueprintModel(blueprint);
  await saveProjectBlueprint(project.id, approvedBlueprint);
  await db
    .update(projects)
    .set({
      status: "generating",
      stackPreferences: stackPreferencesFromBlueprint(approvedBlueprint),
      wizardData: {
        ...((project.wizardData as Record<string, unknown>) ?? {}),
        ...wizardStackFromBlueprint(approvedBlueprint),
      },
      updatedAt: new Date(),
    })
    .where(eq(projects.id, project.id));

  return approvedBlueprint;
}

export async function dispatchSingleDocumentGeneration(
  project: Project,
  documentType: ProjectDocumentType,
  userId: string,
  siteUrl: string,
  options: { autoApproveBlueprint?: boolean } = {}
): Promise<
  | { status: "blocked"; code: "BLUEPRINT_NOT_APPROVED" }
  | { status: "generating" }
  | { status: "generated"; wordCount: number }
  | { status: "error"; detail: string }
> {
  // The app's Documents page deliberately blocks generation until the user
  // reviews/approves the architecture model on the /resolve page. An MCP
  // caller has no equivalent review UI, so it opts into auto-approving
  // (options.autoApproveBlueprint) instead of hitting that gate.
  if (options.autoApproveBlueprint) {
    await ensureBlueprintApproved(project);
  } else {
    let blueprint = await getProjectBlueprint(project);
    if (!blueprint) blueprint = await ensureProjectBlueprint(project);
    const projectDocs = await db.select().from(documents).where(eq(documents.projectId, project.id));
    if (!isBlueprintModelApproved(blueprint, projectDocs)) {
      return { status: "blocked", code: "BLUEPRINT_NOT_APPROVED" };
    }
  }

  await db
    .update(documents)
    .set({ status: "generating", updatedAt: new Date() })
    .where(and(eq(documents.projectId, project.id), eq(documents.type, documentType)));

  const dispatch = await triggerBackgroundWithResult(
    `${siteUrl}/.netlify/functions/generate-background`,
    { projectId: project.id, documentType, userId }
  );
  if (dispatch.dispatched) return { status: "generating" };

  const onNetlify = Boolean(process.env.URL || process.env.NETLIFY);
  if (onNetlify) {
    await db
      .update(documents)
      .set({ status: "pending", updatedAt: new Date() })
      .where(and(eq(documents.projectId, project.id), eq(documents.type, documentType)));
    return { status: "error", detail: dispatch.error ?? "Background dispatch failed" };
  }

  try {
    const { wordCount } = await generateProjectDocument(project.id, documentType, userId);
    return { status: "generated", wordCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.projectId, project.id), eq(documents.type, documentType)))
      .limit(1);
    await db
      .update(documents)
      .set({ status: doc?.content?.trim() ? "needs_revision" : "pending", updatedAt: new Date() })
      .where(and(eq(documents.projectId, project.id), eq(documents.type, documentType)));
    return { status: "error", detail: message };
  }
}

/**
 * Dispatches background generation for every "pending" document on an
 * already-approved project. Checks each dispatch result — a failed/dropped
 * call (e.g. the site mid-deploy) otherwise leaves the document stuck at
 * "generating" forever, since nothing else will ever move it out of that
 * state. Shared by the MCP connector and the app's own "Approve architecture"
 * flow so this can't regress in one place and not the other.
 */
export async function queuePendingDocuments(
  projectId: string,
  userId: string,
  siteUrl: string
): Promise<{ queued: number; documentTypes: string[]; dispatchFailures: string[] }> {
  const pendingDocs = await db
    .select()
    .from(documents)
    .where(and(eq(documents.projectId, projectId), eq(documents.status, "pending")));

  const dispatchFailures: string[] = [];

  for (const doc of pendingDocs) {
    await db.update(documents).set({ status: "generating", updatedAt: new Date() }).where(eq(documents.id, doc.id));

    const dispatch = await triggerBackgroundWithResult(`${siteUrl}/.netlify/functions/generate-background`, {
      projectId,
      documentType: doc.type,
      userId,
    });

    if (!dispatch.dispatched) {
      dispatchFailures.push(doc.type);
      await db.update(documents).set({ status: "pending", updatedAt: new Date() }).where(eq(documents.id, doc.id));
    }
  }

  return {
    queued: pendingDocs.length - dispatchFailures.length,
    documentTypes: pendingDocs.map((d) => d.type),
    dispatchFailures,
  };
}

export async function approveBlueprintAndQueueAllDocuments(
  project: Project,
  userId: string,
  siteUrl: string
): Promise<{ queued: number; documentTypes: string[]; dispatchFailures: string[] }> {
  await ensureBlueprintApproved(project);
  return queuePendingDocuments(project.id, userId, siteUrl);
}
