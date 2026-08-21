import type { ProjectBlueprint, ValidationIssue } from "@/lib/zod/blueprint-schemas";
import { lintTerminology } from "@/lib/blueprint-engine/validate/terminology-lint";
import { validateEntityReferencesInText } from "@/lib/blueprint-engine/validate/structural-completeness";

export type TerminologyEnforcementResult = {
  content: string;
  issues: ValidationIssue[];
  replacements: { from: string; to: string; count: number }[];
  passed: boolean;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replace rejected synonyms with canonical terms (word-boundary safe). */
export function applySynonymReplacements(
  text: string,
  blueprint: ProjectBlueprint
): { content: string; replacements: TerminologyEnforcementResult["replacements"] } {
  let content = text;
  const replacements: TerminologyEnforcementResult["replacements"] = [];

  const sortedEntries = [...blueprint.glossary].sort(
    (a, b) =>
      Math.max(...b.rejectedSynonyms.map((s) => s.length), 0) -
      Math.max(...a.rejectedSynonyms.map((s) => s.length), 0)
  );

  for (const entry of sortedEntries) {
    for (const synonym of entry.rejectedSynonyms) {
      const pattern = new RegExp(`\\b${escapeRegExp(synonym)}\\b`, "gi");
      let count = 0;
      content = content.replace(pattern, () => {
        count += 1;
        return entry.canonical;
      });
      if (count > 0) {
        replacements.push({ from: synonym, to: entry.canonical, count });
      }
    }
  }

  return { content, replacements };
}

export function collectTerminologyIssues(
  blueprint: ProjectBlueprint,
  content: string,
  documentType: string
): ValidationIssue[] {
  return [
    ...lintTerminology(blueprint, content, documentType).issues,
    ...validateEntityReferencesInText(blueprint, content, documentType),
  ];
}

/** Auto-fix synonym drift, then re-lint. */
export function enforceTerminologyOnContent(
  blueprint: ProjectBlueprint,
  content: string,
  documentType: string
): TerminologyEnforcementResult {
  const { content: corrected, replacements } = applySynonymReplacements(content, blueprint);
  const issues = collectTerminologyIssues(blueprint, corrected, documentType);
  const terminologyErrors = issues.filter((i) => i.severity === "error");

  return {
    content: corrected,
    issues,
    replacements,
    passed: terminologyErrors.length === 0,
  };
}
