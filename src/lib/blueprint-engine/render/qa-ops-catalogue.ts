import type { ProjectBlueprint } from "@/lib/zod/blueprint-schemas";
import {
  everyRequirementHasTestCase,
  requirementsMissingTests,
} from "@/lib/blueprint-engine/plan/qa-planner";

const QA_OPS_DOC_TYPES = new Set([
  "implementation_plan",
  "testing_qa_plan",
  "deployment_ops_plan",
  "trd",
  "security_blueprint",
]);

export function serializeQaOpsForPrompt(
  blueprint: ProjectBlueprint,
  documentType: string
): string {
  if (!QA_OPS_DOC_TYPES.has(documentType)) return "";

  const coverageComplete = everyRequirementHasTestCase(blueprint);

  return `
QA & OPERATIONS MODEL (derive tests and deployment steps from this catalogue — do not invent unrelated cases):

Requirements:
\`\`\`json
${JSON.stringify(blueprint.requirements, null, 2)}
\`\`\`

Test cases (${coverageComplete ? "full FR coverage" : "missing coverage for: " + requirementsMissingTests(blueprint).join(", ")}):
\`\`\`json
${JSON.stringify(blueprint.testing.testCases, null, 2)}
\`\`\`

Deployment & operations:
\`\`\`json
${JSON.stringify(blueprint.deployment, null, 2)}
\`\`\`

Rules:
- Reference test case IDs exactly as listed (TC-FR-*-01)
- Map every FR-* requirement to at least one test case
- CI stages must follow deployment.ciPipeline order
- Backup/recovery must reference stateful components listed in deployment.backupRecovery
`.trim();
}
