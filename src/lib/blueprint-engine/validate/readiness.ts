import type { ProjectBlueprint, ValidationIssue } from "@/lib/zod/blueprint-schemas";
import { lintTerminology } from "@/lib/blueprint-engine/validate/terminology-lint";
import {
  validateEntityReferencesInText,
  validateStructuralCompleteness,
} from "@/lib/blueprint-engine/validate/structural-completeness";
import { detectStackConflicts } from "@/lib/blueprint-engine/registry/capabilities";
import { validateDocumentConsistency } from "@/lib/blueprint-engine/validate/consistency-validator";
import { validateSemanticConsistency } from "@/lib/blueprint-engine/validate/semantic-consistency-validator";
import { validateWorkflowDocuments } from "@/lib/blueprint-engine/validate/state-machine-validator";
import { validateAiActionPolicy } from "@/lib/blueprint-engine/validate/ai-action-policy";
import {
  computeReadinessBreakdown,
  type ReadinessScoreOptions,
} from "@/lib/blueprint-engine/validate/compute-readiness-breakdown";
import { codeSnippetIssuesFromContent } from "@/lib/blueprint-engine/validate/code-snippet-qa";
import {
  type DocumentWithStatus,
  canValidateCategory,
  filterIssuesForLifecycle,
} from "@/lib/blueprint-engine/validate/validation-lifecycle";

export type { ReadinessBreakdown } from "@/lib/blueprint-engine/validate/compute-readiness-breakdown";
export type { ReadinessScoreOptions };
export type { CategoryValidationState } from "@/lib/blueprint-engine/validate/validation-lifecycle";

export type DocumentSnapshot = {
  type: string;
  content: string;
  status?: string | null;
};

export function runBlueprintValidation(
  blueprint: ProjectBlueprint,
  documents: DocumentSnapshot[] = [],
  scoreOptions: ReadinessScoreOptions = {}
): { issues: ValidationIssue[]; breakdown: ReturnType<typeof computeReadinessBreakdown> } {
  const documentsWithStatus: DocumentWithStatus[] = documents.map((doc) => ({
    type: doc.type,
    status: doc.status ?? (doc.content?.trim() ? "ready" : "pending"),
    content: doc.content,
  }));

  const readyDocuments = documents.filter((doc) => doc.content?.trim());

  const issues: ValidationIssue[] = [
    ...validateStructuralCompleteness(blueprint, {
      validateEntityFields: canValidateCategory("schema", documentsWithStatus),
      validateIntegrations: canValidateCategory("integrations", documentsWithStatus),
    }),
    ...detectStackConflicts(blueprint.stack).map((message, index) => ({
      id: `STACK-${index}`,
      severity: "error" as const,
      category: "architecture",
      message,
      resolution: "Remove conflicting provider references from the canonical stack",
      documentTypes: [],
    })),
  ];

  for (const doc of readyDocuments) {
    issues.push(...lintTerminology(blueprint, doc.content, doc.type).issues);
    issues.push(...validateEntityReferencesInText(blueprint, doc.content, doc.type));
    issues.push(...codeSnippetIssuesFromContent(doc.content, doc.type));
  }

  if (canValidateCategory("conflicts", documentsWithStatus) && readyDocuments.length > 0) {
    issues.push(...validateDocumentConsistency(blueprint, readyDocuments));
    issues.push(...validateSemanticConsistency(blueprint, readyDocuments));
    issues.push(...validateWorkflowDocuments(blueprint, readyDocuments));
    issues.push(...validateAiActionPolicy(blueprint, readyDocuments));
  }

  const lifecycleIssues = filterIssuesForLifecycle(issues, documentsWithStatus);
  const breakdown = computeReadinessBreakdown(
    blueprint,
    documents,
    lifecycleIssues,
    scoreOptions,
    documentsWithStatus
  );

  return { issues: lifecycleIssues, breakdown };
}
