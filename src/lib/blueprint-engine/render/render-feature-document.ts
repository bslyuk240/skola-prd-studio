import type { FeatureBlueprint, ProjectBlueprint } from "@/lib/zod/blueprint-schemas";
import { buildGlossaryPromptBlock } from "@/lib/blueprint-engine/validate/terminology-lint";
import { canonicalTableNames } from "@/lib/blueprint-engine/extract/build-feature-blueprint";
import { buildFeaturePrompt, type FeatureContext } from "@/lib/feature-prompts";

export const FEATURE_DOCUMENT_TYPES = [
  "feature_prd",
  "impact_analysis",
  "schema_changes",
  "api_changes",
  "ui_changes",
  "security_checklist",
  "implementation_tasks",
  "test_plan",
  "deployment_plan",
] as const;

export type FeatureDocumentType = (typeof FEATURE_DOCUMENT_TYPES)[number];

function serializeEntityRegistryBlock(
  featureBlueprint: FeatureBlueprint,
  linkedProjectBlueprint: ProjectBlueprint | null
): string {
  const linked = linkedProjectBlueprint?.entities ?? featureBlueprint.linkedEntities;
  if (Object.keys(linked).length === 0) return "";

  const lines = Object.values(linked).map(
    (entity) =>
      `- ${entity.id} → table \`${entity.tableName}\`${entity.description ? `: ${entity.description}` : ""}`
  );

  const newEntities = Object.values(featureBlueprint.impactedEntities);
  const newLines = newEntities.map(
    (entity) =>
      `- NEW ${entity.id} → table \`${entity.tableName}\`${entity.description ? `: ${entity.description}` : ""}`
  );

  return `
CANONICAL ENTITY REGISTRY (locked table names — use these exact names for existing tables):
${lines.join("\n")}
${newLines.length ? `\nNEW ENTITIES FOR THIS FEATURE:\n${newLines.join("\n")}` : ""}

Rules:
- When altering existing tables, reference the exact \`tableName\` values above
- Do not rename canonical tables (e.g. use \`users\`, not \`user_accounts\`)
- New tables must list foreign keys to canonical tables using their exact names
`.trim();
}

function serializeFeatureApiBlock(featureBlueprint: FeatureBlueprint): string {
  if (featureBlueprint.deltaApis.length === 0) return "";

  return `
FEATURE API DELTA (derive endpoint specs from this catalogue):
\`\`\`json
${JSON.stringify(featureBlueprint.deltaApis, null, 2)}
\`\`\`
`.trim();
}

export function serializeFeatureQaOpsForPrompt(
  featureBlueprint: FeatureBlueprint,
  linkedProjectBlueprint: ProjectBlueprint | null,
  documentType: string
): string {
  if (documentType !== "test_plan" && documentType !== "deployment_plan") return "";

  const projectQa = linkedProjectBlueprint?.testing.testCases ?? [];
  const projectDeployment = linkedProjectBlueprint?.deployment;

  return `
FEATURE QA & OPERATIONS MODEL (derive ${documentType.replace("_", " ")} from this catalogue):

Feature requirements:
\`\`\`json
${JSON.stringify(featureBlueprint.requirements.functional, null, 2)}
\`\`\`

Feature test cases (reference IDs exactly — TC-FEAT-*):
\`\`\`json
${JSON.stringify(featureBlueprint.testing.testCases, null, 2)}
\`\`\`

Feature deployment delta:
\`\`\`json
${JSON.stringify(featureBlueprint.deployment, null, 2)}
\`\`\`

${projectQa.length ? `Linked project test catalogue (align integration tests where relevant):\n\`\`\`json\n${JSON.stringify(projectQa.slice(0, 12), null, 2)}\n\`\`\`` : ""}

${projectDeployment?.ciPipeline ? `Linked project CI pipeline order:\n\`\`\`json\n${JSON.stringify(projectDeployment.ciPipeline, null, 2)}\n\`\`\`` : ""}

Rules:
- Map every FR-FEAT-* requirement to at least one TC-FEAT-* test case
- Reference test case IDs exactly as listed
- Deployment steps must follow linked project CI stage order when a project blueprint is linked
- Include explicit rollback steps from the feature deployment model
`.trim();
}

function serializeFeatureModelBlock(featureBlueprint: FeatureBlueprint): string {
  return `
FEATURE BLUEPRINT MODEL:
\`\`\`json
${JSON.stringify(
  {
    feature: featureBlueprint.feature,
    impactedEntities: featureBlueprint.impactedEntities,
    deltaApis: featureBlueprint.deltaApis,
    requirements: featureBlueprint.requirements,
  },
  null,
  2
)}
\`\`\`
`.trim();
}

/** Model-bound feature document prompt — supplements legacy feature prompts. */
export function renderFeatureDocument(
  documentType: string,
  ctx: FeatureContext,
  featureBlueprint: FeatureBlueprint,
  linkedProjectBlueprint: ProjectBlueprint | null = null
): string {
  const basePrompt = buildFeaturePrompt(documentType, ctx);
  const blocks = [basePrompt, serializeFeatureModelBlock(featureBlueprint)];

  const glossarySource = linkedProjectBlueprint;
  const glossary =
    glossarySource && glossarySource.glossary.length > 0
      ? buildGlossaryPromptBlock(glossarySource)
      : featureBlueprint.glossary.length > 0
        ? buildGlossaryPromptBlock({
            glossary: featureBlueprint.glossary,
          } as ProjectBlueprint)
        : "";
  if (glossary) blocks.push(glossary);

  if (documentType === "schema_changes" || documentType === "api_changes" || documentType === "impact_analysis") {
    blocks.push(serializeEntityRegistryBlock(featureBlueprint, linkedProjectBlueprint));
  }

  if (documentType === "api_changes" || documentType === "schema_changes") {
    blocks.push(serializeFeatureApiBlock(featureBlueprint));
  }

  if (documentType === "schema_changes") {
    const tables = canonicalTableNames(featureBlueprint, linkedProjectBlueprint);
    if (tables.length > 0) {
      blocks.push(
        `Required canonical table names in this document: ${tables.map((t) => `\`${t}\``).join(", ")}`
      );
    }
  }

  const qaOps = serializeFeatureQaOpsForPrompt(featureBlueprint, linkedProjectBlueprint, documentType);
  if (qaOps) blocks.push(qaOps);

  return blocks.filter(Boolean).join("\n\n");
}
