import type { ProjectBlueprint, ValidationIssue } from "@/lib/zod/blueprint-schemas";
import { lintTerminology } from "@/lib/blueprint-engine/validate/terminology-lint";
import {
  validateEntityReferencesInText,
  validateStructuralCompleteness,
} from "@/lib/blueprint-engine/validate/structural-completeness";
import { detectStackConflicts } from "@/lib/blueprint-engine/registry/capabilities";
import { validateDocumentConsistency } from "@/lib/blueprint-engine/validate/consistency-validator";
import { validateWorkflowDocuments } from "@/lib/blueprint-engine/validate/state-machine-validator";
import { validateAiActionPolicy } from "@/lib/blueprint-engine/validate/ai-action-policy";
import {
  computeReadinessBreakdown,
  type ReadinessScoreOptions,
} from "@/lib/blueprint-engine/validate/compute-readiness-breakdown";
import { codeSnippetIssuesFromContent } from "@/lib/blueprint-engine/validate/code-snippet-qa";

export type { ReadinessBreakdown } from "@/lib/blueprint-engine/validate/compute-readiness-breakdown";
export type { ReadinessScoreOptions };

export type DocumentSnapshot = {
  type: string;
  content: string;
};

export function runBlueprintValidation(
  blueprint: ProjectBlueprint,
  documents: DocumentSnapshot[] = [],
  scoreOptions: ReadinessScoreOptions = {}
): { issues: ValidationIssue[]; breakdown: ReturnType<typeof computeReadinessBreakdown> } {
  const issues: ValidationIssue[] = [
    ...validateStructuralCompleteness(blueprint),
    ...detectStackConflicts(blueprint.stack).map((message, index) => ({
      id: `STACK-${index}`,
      severity: "error" as const,
      category: "architecture",
      message,
      resolution: "Remove conflicting provider references from the canonical stack",
      documentTypes: [],
    })),
  ];

  for (const doc of documents) {
    issues.push(...lintTerminology(blueprint, doc.content, doc.type).issues);
    issues.push(...validateEntityReferencesInText(blueprint, doc.content, doc.type));
    issues.push(...codeSnippetIssuesFromContent(doc.content, doc.type));
  }

  if (documents.length > 0) {
    issues.push(...validateDocumentConsistency(blueprint, documents));
    issues.push(...validateWorkflowDocuments(blueprint, documents));
    issues.push(...validateAiActionPolicy(blueprint, documents));
  }

  const breakdown = computeReadinessBreakdown(blueprint, documents, issues, scoreOptions);

  return { issues, breakdown };
}
