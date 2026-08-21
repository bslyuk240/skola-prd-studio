import type { ProjectContext } from "@/lib/ai-prompts";
import { getDocumentInstructions } from "@/lib/ai-prompts";
import type { ProjectBlueprint } from "@/lib/zod/blueprint-schemas";
import {
  type BlueprintDocumentType,
  getSectionsForDocument,
  isBlueprintDocumentType,
} from "@/lib/blueprint-engine/render/document-sections";
import {
  buildGanttTimelineRules,
  buildImplementationPhaseOrderRules,
  buildModelBindingBlock,
  buildStateMachineBinding,
} from "@/lib/blueprint-engine/render/model-binding";
import { serializeBlueprintForPrompt } from "@/lib/blueprint-engine/render/prompt-context";
import { serializeApiCatalogueForPrompt } from "@/lib/blueprint-engine/render/api-catalogue";
import { serializeQaOpsForPrompt } from "@/lib/blueprint-engine/render/qa-ops-catalogue";
import {
  renderApiIntegrationSpec,
  renderDeploymentOpsPlan,
  renderTestingQaPlan,
} from "@/lib/blueprint-engine/render/new-doc-renderers";

const LEGACY_DOCUMENT_TYPES = new Set<BlueprintDocumentType>([
  "prd",
  "trd",
  "app_flow",
  "ux_brief",
  "backend_schema",
  "implementation_plan",
  "security_blueprint",
]);

function documentSpecificInstructions(
  docType: BlueprintDocumentType,
  blueprint: ProjectBlueprint,
  ctx: ProjectContext
): string {
  if (docType === "api_integration_spec") {
    return renderApiIntegrationSpec(blueprint, ctx);
  }
  if (docType === "testing_qa_plan") {
    return renderTestingQaPlan(blueprint, ctx);
  }
  if (docType === "deployment_ops_plan") {
    return renderDeploymentOpsPlan(blueprint, ctx);
  }

  const legacy = getDocumentInstructions(docType, ctx);

  if (docType === "implementation_plan") {
    return `${legacy}

${buildGanttTimelineRules(blueprint)}

${buildImplementationPhaseOrderRules(blueprint)}`.trim();
  }

  if (docType === "backend_schema" || docType === "trd") {
    return `${legacy}

Use ONLY tables from the canonical entity registry when defining schema and ERD diagrams.`;
  }

  if (docType === "app_flow") {
    return `${legacy}

${buildStateMachineBinding(blueprint)}`;
  }

  return legacy;
}

/** Model-driven document prompt — replaces buildPrompt + manual catalogue assembly. */
export function renderDocument(
  docType: string,
  blueprint: ProjectBlueprint,
  ctx: ProjectContext
): string {
  const resolvedType: BlueprintDocumentType = isBlueprintDocumentType(docType)
    ? docType
    : "prd";

  const sections = getSectionsForDocument(resolvedType);
  const binding = buildModelBindingBlock(blueprint, resolvedType);
  const instructions = documentSpecificInstructions(resolvedType, blueprint, ctx);
  const canonicalBlock = serializeBlueprintForPrompt(blueprint, sections);
  const apiCatalogueBlock = serializeApiCatalogueForPrompt(blueprint, resolvedType);
  const qaOpsBlock = serializeQaOpsForPrompt(blueprint, resolvedType);

  const blocks = [
    binding,
    instructions,
    canonicalBlock,
    apiCatalogueBlock,
    qaOpsBlock,
  ].filter(Boolean);

  return blocks.join("\n\n");
}

export function renderDocumentUsesLegacyInstructions(docType: string): boolean {
  return LEGACY_DOCUMENT_TYPES.has(docType as BlueprintDocumentType);
}

export { getSectionsForDocument, isBlueprintDocumentType };
export {
  BLUEPRINT_DOCUMENT_TYPES,
  DOCUMENT_SECTIONS,
} from "@/lib/blueprint-engine/render/document-sections";
export type { BlueprintDocumentType } from "@/lib/blueprint-engine/render/document-sections";
