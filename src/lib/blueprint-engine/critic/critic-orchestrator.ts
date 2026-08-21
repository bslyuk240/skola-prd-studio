import type { ProjectBlueprint, ValidationIssue } from "@/lib/zod/blueprint-schemas";
import { runBlueprintValidation, type ReadinessBreakdown } from "@/lib/blueprint-engine/validate/readiness";
import { enforceTerminologyOnContent } from "@/lib/blueprint-engine/validate/enforce-terminology";
import { enforceStackLockInText } from "@/lib/blueprint-engine/validate/stack-lock";
import {
  patchBlueprintFromIssues,
  affectedDocumentTypes,
  isResolvableIssue,
  type BlueprintPatch,
} from "@/lib/blueprint-engine/critic/conflict-resolver";

export const MAX_CRITIC_ITERATIONS = 2;

export type CriticDocument = {
  type: string;
  content: string;
};

export type GenerateDocumentFn = (
  documentType: string,
  blueprint: ProjectBlueprint,
  previousContent: string
) => Promise<string>;

export type ArchitectCriticResult = {
  blueprint: ProjectBlueprint;
  documents: CriticDocument[];
  issues: ValidationIssue[];
  breakdown: ReadinessBreakdown;
  iterations: number;
  patches: BlueprintPatch[];
  regenTargets: string[];
  resolvedIssueIds: string[];
  unresolvedIssueIds: string[];
};

type RunArchitectCriticParams = {
  blueprint: ProjectBlueprint;
  documents: CriticDocument[];
  generateDocument?: GenerateDocumentFn;
  maxIterations?: number;
};

function hasBlockingErrors(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error");
}

function resolvableErrors(issues: ValidationIssue[]): ValidationIssue[] {
  return issues.filter((issue) => issue.severity === "error" && isResolvableIssue(issue));
}

async function regenerateDocument(
  documentType: string,
  blueprint: ProjectBlueprint,
  previousContent: string,
  generateDocument?: GenerateDocumentFn
): Promise<string> {
  if (generateDocument) {
    const generated = await generateDocument(documentType, blueprint, previousContent);
    const terminology = enforceTerminologyOnContent(blueprint, generated, documentType);
    return enforceStackLockInText(terminology.content, blueprint);
  }

  const terminology = enforceTerminologyOnContent(blueprint, previousContent, documentType);
  return enforceStackLockInText(terminology.content, blueprint);
}

/** Run validators, patch model, and selectively regenerate affected docs (P8-1, P8-3, P8-4). */
export async function runArchitectCritic(
  params: RunArchitectCriticParams
): Promise<ArchitectCriticResult> {
  const maxIterations = params.maxIterations ?? MAX_CRITIC_ITERATIONS;
  let blueprint = params.blueprint;
  let documents = params.documents.map((doc) => ({ ...doc }));
  const allPatches: BlueprintPatch[] = [];
  const allResolvedIssueIds = new Set<string>();
  const regenTargets = new Set<string>();
  let iterations = 0;
  let issues: ValidationIssue[] = [];
  let breakdown: ReadinessBreakdown = runBlueprintValidation(blueprint, documents).breakdown;

  while (iterations < maxIterations) {
    const validation = runBlueprintValidation(blueprint, documents);
    issues = validation.issues;
    breakdown = validation.breakdown;

    if (!hasBlockingErrors(issues)) break;

    const fixable = resolvableErrors(issues);
    if (fixable.length === 0) break;

    const { blueprint: patchedBlueprint, patches, resolvedIssueIds } = patchBlueprintFromIssues(
      blueprint,
      fixable,
      documents
    );

    if (patches.length === 0 && fixable.every((issue) => issue.category !== "terminology")) break;

    blueprint = patchedBlueprint;
    allPatches.push(...patches);
    resolvedIssueIds.forEach((id) => allResolvedIssueIds.add(id));

    const targets = affectedDocumentTypes(fixable);
    for (const documentType of targets) {
      const docIndex = documents.findIndex((doc) => doc.type === documentType);
      if (docIndex < 0) continue;

      documents[docIndex] = {
        type: documentType,
        content: await regenerateDocument(
          documentType,
          blueprint,
          documents[docIndex].content,
          params.generateDocument
        ),
      };
      regenTargets.add(documentType);
    }

    iterations += 1;
  }

  const finalValidation = runBlueprintValidation(blueprint, documents);
  issues = finalValidation.issues;
  breakdown = finalValidation.breakdown;

  const unresolvedIssueIds = issues
    .filter((issue) => issue.severity === "error")
    .map((issue) => issue.id)
    .filter((id) => !allResolvedIssueIds.has(id));

  return {
    blueprint,
    documents,
    issues,
    breakdown,
    iterations,
    patches: allPatches,
    regenTargets: [...regenTargets],
    resolvedIssueIds: [...allResolvedIssueIds],
    unresolvedIssueIds,
  };
}
