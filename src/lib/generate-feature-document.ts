import { db } from "@/db";
import {
  featureRequests,
  featureDocuments,
  repoConnections,
  userPreferences,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { FeatureContext } from "@/lib/feature-prompts";
import { generateText, DEFAULT_MODEL } from "@/lib/openrouter";
import { calcFeatureDocCredits } from "@/lib/credits";
import {
  ensureFeatureBlueprint,
} from "@/lib/blueprint-engine/feature-blueprint-service";
import { renderFeatureDocument } from "@/lib/blueprint-engine/render/render-feature-document";
import { enforceTerminologyOnContent } from "@/lib/blueprint-engine/validate/enforce-terminology";
import {
  featureConsistencyErrorsForDocument,
  validateFeatureDocuments,
} from "@/lib/blueprint-engine/validate/feature-validation";
import {
  stripInvalidCodeSnippets,
  sanitizeDocumentsCodeSnippets,
} from "@/lib/blueprint-engine/validate/code-snippet-qa";
import type { DocumentSnapshot } from "@/lib/blueprint-engine/validate/readiness";

export type FeatureDocumentType =
  | "feature_prd"
  | "impact_analysis"
  | "schema_changes"
  | "api_changes"
  | "ui_changes"
  | "security_checklist"
  | "implementation_tasks"
  | "test_plan"
  | "deployment_plan";

function buildFeatureContext(
  request: typeof featureRequests.$inferSelect,
  repoConn: typeof repoConnections.$inferSelect | null
): FeatureContext {
  const keyFiles = (repoConn?.keyFilesContent as Record<string, string>) ?? {};
  const keyFilesContext = Object.entries(keyFiles)
    .map(([f, c]) => `--- ${f} ---\n${c}`)
    .join("\n")
    .slice(0, 5000);

  const fileTree = (repoConn?.fileTree as { path: string; type?: string }[] | null) ?? [];
  const modules = fileTree
    .filter((entry) => entry.path.includes("/") && !entry.path.startsWith("."))
    .map((entry) => entry.path.split("/")[0]!)
    .filter(Boolean);
  const apiRoutes = fileTree
    .filter((entry) => entry.path.includes("api/") || entry.path.includes("routes/"))
    .map((entry) => entry.path)
    .slice(0, 30);

  return {
    featureName: request.featureName,
    featureDescription: request.featureDescription,
    affectedRoles: request.affectedRoles ?? undefined,
    affectsPermissions: request.affectsPermissions ?? false,
    needsNewTables: request.needsNewTables ?? false,
    needsNotifications: request.needsNotifications ?? false,
    affectsDashboard: request.affectsDashboard ?? false,
    mobileRequired: request.mobileRequired ?? false,
    affectsBilling: request.affectsBilling ?? false,
    scopeLevel: request.scopeLevel ?? "mvp",
    additionalContext: request.additionalContext ?? undefined,
    detectedStack: (repoConn?.detectedStack as FeatureContext["detectedStack"]) ?? undefined,
    projectSummary: repoConn?.projectSummary ?? undefined,
    modules: modules.length > 0 ? [...new Set(modules)] : undefined,
    apiRoutes: apiRoutes.length > 0 ? apiRoutes : undefined,
    keyFilesContext,
  };
}

export async function generateFeatureDocument(
  featureRequestId: string,
  documentType: FeatureDocumentType,
  userId: string
): Promise<{ wordCount: number }> {
  const [request] = await db
    .select()
    .from(featureRequests)
    .where(and(eq(featureRequests.id, featureRequestId), eq(featureRequests.userId, userId)))
    .limit(1);

  if (!request) {
    throw new Error("Feature request not found");
  }

  let repoConn: typeof repoConnections.$inferSelect | null = null;
  if (request.repoConnectionId) {
    const [conn] = await db
      .select()
      .from(repoConnections)
      .where(eq(repoConnections.id, request.repoConnectionId))
      .limit(1);
    repoConn = conn ?? null;
  }

  const [userPrefs] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  const savedModel = userPrefs?.aiModel ?? DEFAULT_MODEL;
  const model =
    savedModel === "google/gemini-2.0-flash-001" ? DEFAULT_MODEL : savedModel;

  const { featureBlueprint, linkedProjectBlueprint } = await ensureFeatureBlueprint(
    request,
    userId
  );
  const ctx = buildFeatureContext(request, repoConn);
  const prompt = renderFeatureDocument(
    documentType,
    ctx,
    featureBlueprint,
    linkedProjectBlueprint
  );

  let content = await generateText(prompt, model);

  if (linkedProjectBlueprint) {
    const terminology = enforceTerminologyOnContent(
      linkedProjectBlueprint,
      content,
      documentType
    );
    content = terminology.content;
  }

  const snippetQa = stripInvalidCodeSnippets(content, documentType);
  content = snippetQa.content;

  const allDocs = await db
    .select()
    .from(featureDocuments)
    .where(eq(featureDocuments.featureRequestId, featureRequestId));

  let docSnapshots: DocumentSnapshot[] = allDocs
    .filter((doc) => doc.content || doc.type === documentType)
    .map((doc) => ({
      type: doc.type,
      content: doc.type === documentType ? content : doc.content ?? "",
    }));

  const sanitized = sanitizeDocumentsCodeSnippets(docSnapshots);
  docSnapshots = sanitized.documents;
  const generatedDoc = sanitized.documents.find((doc) => doc.type === documentType);
  content = generatedDoc?.content ?? content;

  const validationIssues = validateFeatureDocuments(
    featureBlueprint,
    linkedProjectBlueprint,
    docSnapshots
  );
  const allIssues = [...validationIssues, ...snippetQa.issues, ...sanitized.issues];
  const consistencyFailed =
    featureConsistencyErrorsForDocument(allIssues, documentType).length > 0;
  const terminologyFailed = linkedProjectBlueprint
    ? allIssues.some(
        (issue) =>
          issue.category === "terminology" &&
          issue.severity === "error" &&
          issue.documentTypes.includes(documentType)
      )
    : false;

  const finalStatus =
    consistencyFailed || terminologyFailed ? "needs_revision" : "ready";
  const wordCount = content.split(/\s+/).length;
  const aiCreditsUsed = calcFeatureDocCredits(wordCount);

  await db
    .update(featureDocuments)
    .set({
      content,
      wordCount,
      aiCreditsUsed,
      status: finalStatus,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(featureDocuments.featureRequestId, featureRequestId),
        eq(featureDocuments.type, documentType)
      )
    );

  return { wordCount };
}
