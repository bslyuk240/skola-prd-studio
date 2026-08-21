import { db } from "@/db";
import { projects, documents, userPreferences, securityChecks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { ProjectContext } from "@/lib/ai-prompts";
import { generateText, DEFAULT_MODEL } from "@/lib/openrouter";
import { calcDocCredits } from "@/lib/credits";
import { enrichPromptWithEie } from "@/lib/eie/prd-connector";
import { ensureProjectBlueprint, saveProjectBlueprint } from "@/lib/blueprint-engine/project-blueprint-service";
import {
  countSecurityTodosFromWizard,
  mergeSecurityTodoCounts,
} from "@/lib/blueprint-engine/security-todo-scoring";
import type { DocumentSnapshot } from "@/lib/blueprint-engine/validate/readiness";
import {
  renderDocument,
  runBlueprintValidation,
  computeReadinessBreakdown,
  enforceTerminologyOnContent,
  enforceStackLockInText,
  consistencyErrorsForDocument,
  workflowErrorsForDocument,
  aiPolicyErrorsForDocument,
  runArchitectCritic,
  stripInvalidCodeSnippets,
  sanitizeDocumentsCodeSnippets,
} from "@/lib/blueprint-engine";
import type { ProjectDocumentType } from "@/lib/project-document-types";
import { PROJECT_DOCUMENT_COUNT } from "@/lib/project-document-types";

type DocumentType = ProjectDocumentType;

export async function generateProjectDocument(
  projectId: string,
  documentType: DocumentType,
  userId: string
): Promise<{ wordCount: number }> {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!project) {
    throw new Error("Project not found");
  }

  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.projectId, projectId), eq(documents.type, documentType)))
    .limit(1);

  const [userPrefs] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  const savedModel = userPrefs?.aiModel ?? DEFAULT_MODEL;
  const model =
    savedModel === "google/gemini-2.0-flash-001" ? DEFAULT_MODEL : savedModel;

  const ctx = (project.wizardData ?? {}) as ProjectContext;
  ctx.appName = project.name;
  ctx.shortDescription = project.description ?? "";
  ctx.securityLevel = project.securityLevel ?? "standard";

  let blueprintModel = await ensureProjectBlueprint(project);
  const basePrompt = renderDocument(documentType, blueprintModel, ctx);
  const prompt = await enrichPromptWithEie({
    project,
    documentType,
    documentId: doc?.id,
    basePrompt,
  });

  let content = await generateText(prompt, model);
  const terminology = enforceTerminologyOnContent(blueprintModel, content, documentType);
  content = enforceStackLockInText(terminology.content, blueprintModel);
  const initialSnippetQa = stripInvalidCodeSnippets(content, documentType);
  content = initialSnippetQa.content;

  const wordCount = content.split(/\s+/).length;
  const aiCreditsUsed = calcDocCredits(wordCount);

  await db
    .update(documents)
    .set({
      content,
      wordCount,
      aiCreditsUsed,
      status: "generating",
      version: 1,
      updatedAt: new Date(),
    })
    .where(and(eq(documents.projectId, projectId), eq(documents.type, documentType)));

  const allDocs = await db.select().from(documents).where(eq(documents.projectId, projectId));
  let docSnapshots: DocumentSnapshot[] = allDocs
    .filter((d) => d.content)
    .map((d) => ({ type: d.type, content: d.content! }));

  const criticResult = await runArchitectCritic({
    blueprint: blueprintModel,
    documents: docSnapshots,
    generateDocument: async (docType, blueprint, _previousContent) => {
      const regenPrompt = renderDocument(docType as DocumentType, blueprint, ctx);
      const enrichedPrompt = await enrichPromptWithEie({
        project,
        documentType: docType as DocumentType,
        documentId: doc?.id,
        basePrompt: regenPrompt,
      });
      let regenContent = await generateText(enrichedPrompt, model);
      const regenTerminology = enforceTerminologyOnContent(blueprint, regenContent, docType);
      const locked = enforceStackLockInText(regenTerminology.content, blueprint);
      return stripInvalidCodeSnippets(locked, docType).content;
    },
  });

  blueprintModel = criticResult.blueprint;

  const sanitizedCriticDocs = sanitizeDocumentsCodeSnippets(criticResult.documents);
  const snippetIssues = [...initialSnippetQa.issues, ...sanitizedCriticDocs.issues];

  for (const criticDoc of sanitizedCriticDocs.documents) {
    const existing = allDocs.find((d) => d.type === criticDoc.type);
    if (!existing || existing.content === criticDoc.content) continue;

    const criticWordCount = criticDoc.content.split(/\s+/).length;
    await db
      .update(documents)
      .set({
        content: criticDoc.content,
        wordCount: criticWordCount,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(documents.projectId, projectId),
          eq(documents.type, criticDoc.type as DocumentType)
        )
      );
  }

  docSnapshots = sanitizedCriticDocs.documents.filter((d) => d.content?.trim());

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

  const validation = runBlueprintValidation(
    blueprintModel,
    docSnapshots,
    securityTodoCounts
  );
  const issues = [...validation.issues];
  for (const issue of snippetIssues) {
    if (!issues.some((existing) => existing.id === issue.id)) {
      issues.push(issue);
    }
  }
  const breakdown = computeReadinessBreakdown(
    blueprintModel,
    docSnapshots,
    issues,
    securityTodoCounts
  );
  const criticDoc = sanitizedCriticDocs.documents.find((d) => d.type === documentType);
  const finalContent = criticDoc?.content ?? content;
  const finalTerminology = enforceTerminologyOnContent(
    blueprintModel,
    finalContent,
    documentType
  );
  const consistencyFailed = consistencyErrorsForDocument(issues, documentType).length > 0;
  const workflowFailed = workflowErrorsForDocument(issues, documentType).length > 0;
  const aiPolicyFailed = aiPolicyErrorsForDocument(issues, documentType).length > 0;
  const finalStatus =
    finalTerminology.passed && !consistencyFailed && !workflowFailed && !aiPolicyFailed
      ? "ready"
      : "needs_revision";

  await db
    .update(documents)
    .set({ status: finalStatus, updatedAt: new Date() })
    .where(and(eq(documents.projectId, projectId), eq(documents.type, documentType)));

  const refreshedDocs = await db
    .select()
    .from(documents)
    .where(eq(documents.projectId, projectId));
  const ready = refreshedDocs.filter(
    (d) => d.status === "ready" || d.status === "approved"
  ).length;
  const readinessScore = breakdown.overall;
  const securityScore = breakdown.security;

  await saveProjectBlueprint(projectId, blueprintModel, breakdown);

  await db
    .update(projects)
    .set({
      readinessScore,
      securityScore,
      status: ready === PROJECT_DOCUMENT_COUNT ? "review" : "generating",
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId));

  return { wordCount: finalContent.split(/\s+/).length };
}
