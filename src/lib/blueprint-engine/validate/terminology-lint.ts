import type { ProjectBlueprint, ValidationIssue } from "@/lib/zod/blueprint-schemas";

export type TerminologyLintResult = {
  issues: ValidationIssue[];
  forbiddenTermsFound: { term: string; canonical: string; context: string }[];
};

export function lintTerminology(
  blueprint: ProjectBlueprint,
  text: string,
  documentType?: string
): TerminologyLintResult {
  const issues: ValidationIssue[] = [];
  const forbiddenTermsFound: TerminologyLintResult["forbiddenTermsFound"] = [];
  const lower = text.toLowerCase();

  for (const entry of blueprint.glossary) {
    for (const synonym of entry.rejectedSynonyms) {
      const pattern = new RegExp(`\\b${escapeRegExp(synonym.toLowerCase())}\\b`, "i");
      if (pattern.test(lower)) {
        forbiddenTermsFound.push({
          term: synonym,
          canonical: entry.canonical,
          context: entry.definition,
        });
        issues.push({
          id: `TERM-${entry.canonical}-${synonym}`,
          severity: "error",
          category: "terminology",
          message: `Use "${entry.canonical}" instead of "${synonym}" (${entry.definition})`,
          resolution: `Replace all references to "${synonym}" with "${entry.canonical}"`,
          documentTypes: documentType ? [documentType] : [],
        });
      }
    }
  }

  return { issues, forbiddenTermsFound };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildGlossaryPromptBlock(blueprint: ProjectBlueprint): string {
  if (blueprint.glossary.length === 0) return "";

  const lines = blueprint.glossary.map(
    (entry) =>
      `- ${entry.canonical}: ${entry.definition}. Do NOT use: ${entry.rejectedSynonyms.join(", ") || "(none)"}`
  );

  return `
TERMINOLOGY REGISTRY (locked — do not rename):
${lines.join("\n")}
`.trim();
}
