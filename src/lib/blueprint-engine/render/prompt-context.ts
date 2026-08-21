import type { ProjectBlueprint } from "@/lib/zod/blueprint-schemas";
import { buildGlossaryPromptBlock } from "@/lib/blueprint-engine/validate/terminology-lint";

export function serializeBlueprintForPrompt(
  blueprint: ProjectBlueprint,
  sections?: (keyof ProjectBlueprint)[]
): string {
  const payload: Record<string, unknown> = sections
    ? Object.fromEntries(sections.map((key) => [key, blueprint[key]]))
    : blueprint;

  const glossary = buildGlossaryPromptBlock(blueprint);

  return `
CANONICAL PROJECT MODEL (source of truth — do not rename entities or contradict this model):

\`\`\`json
${JSON.stringify(payload, null, 2)}
\`\`\`

${glossary}

Rules:
- Every entity name, role, API path, and integration must match the canonical model
- Do not invent alternate table names or synonyms listed as rejected
- Classify KPIs and performance claims as TARGET or ASSUMPTION unless user-provided
- Use model profiles (FAST, BALANCED, REASONING) — never hard-code LLM model IDs as the only option
- Use Week 1/Week 2 timelines unless projectStartDate is set
- If stack.locked is true, do not reference providers not in stack
`.trim();
}
