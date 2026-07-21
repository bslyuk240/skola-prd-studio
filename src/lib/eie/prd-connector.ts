import { db } from "@/db";
import { eiePrdRetrievals, type Project } from "@/db/schema";
import type { ProjectContext } from "@/lib/ai-prompts";
import { isEieEnabledForProject } from "@/lib/eie/project-settings";
import { searchPublishedByVector } from "@/lib/eie/search";

export { isEieEnabledForProject } from "@/lib/eie/project-settings";

const MAX_EIE_CHARS = 4000;

const DOCUMENT_TOPIC_HINTS: Record<string, string[]> = {
  prd: ["architecture", "api", "security"],
  trd: ["architecture", "scaling", "database"],
  app_flow: ["frontend", "ux", "api"],
  ux_brief: ["frontend", "ux"],
  backend_schema: ["database", "persistence", "api"],
  implementation_plan: ["architecture", "devops", "deployment"],
  security_blueprint: ["security", "authentication", "compliance", "rbac"],
};

function buildSearchQuery(project: Project, documentType: string): string {
  const wizard = (project.wizardData ?? {}) as ProjectContext;
  const hints = DOCUMENT_TOPIC_HINTS[documentType] ?? [];
  const parts = [
    project.name,
    project.description ?? "",
    wizard.mainFeatures ?? "",
    wizard.database ?? "",
    wizard.authProvider ?? "",
    wizard.backendFramework ?? "",
    project.securityLevel ?? "",
    ...hints,
  ];
  return parts.filter(Boolean).join(" ");
}

function formatConceptBlock(
  concept: {
    slug: string;
    conceptName: string;
    summary: string;
    securityConsiderations: unknown;
    implementationRecommendations: unknown;
  }
): string {
  const security = Array.isArray(concept.securityConsiderations)
    ? concept.securityConsiderations.join("; ")
    : String(concept.securityConsiderations ?? "");
  const implementation =
    typeof concept.implementationRecommendations === "object"
      ? JSON.stringify(concept.implementationRecommendations)
      : String(concept.implementationRecommendations ?? "");

  return [
    `### CURATED ENGINEERING STANDARD: ${concept.conceptName.toUpperCase()}`,
    `[EIE slug: ${concept.slug}]`,
    `- Summary: ${concept.summary}`,
    `- Security: ${security}`,
    `- Implementation: ${implementation.slice(0, 600)}`,
  ].join("\n");
}

function trimToCharBudget(blocks: string[], maxChars: number): string[] {
  const kept: string[] = [];
  let total = 0;
  for (const block of blocks) {
    if (total + block.length > maxChars) break;
    kept.push(block);
    total += block.length + 2;
  }
  return kept;
}

export async function buildEieContext(params: {
  project: Project;
  documentType: string;
  documentId?: string;
}): Promise<string> {
  const { project, documentType, documentId } = params;

  if (!isEieEnabledForProject(project)) {
    return "";
  }

  const query = buildSearchQuery(project, documentType);
  const matches = await searchPublishedByVector(query, 5);
  if (matches.length === 0) return "";

  const blocks = trimToCharBudget(
    matches.map(({ row }) => formatConceptBlock(row)),
    MAX_EIE_CHARS
  );

  if (blocks.length === 0) return "";

  const topMatches = matches.slice(0, blocks.length);
  if (documentId) {
    await db.insert(eiePrdRetrievals).values(
      topMatches.map(({ row, score }) => ({
        projectId: project.id,
        documentId,
        publishedKnowledgeId: row.id,
        relevanceScore: score.toFixed(3),
      }))
    );
  }

  return [
    "=== MANDATORY SYSTEM ARCHITECTURE RULES ===",
    "Based on company approved engineering rules:",
    ...blocks,
    "==========================================",
  ].join("\n");
}

export async function enrichPromptWithEie(params: {
  project: Project;
  documentType: string;
  documentId?: string;
  basePrompt: string;
}): Promise<string> {
  try {
    const block = await buildEieContext(params);
    if (!block) return params.basePrompt;
    return `${block}\n\n---\n\n${params.basePrompt}`;
  } catch (error) {
    console.error("[eie] PRD enrichment failed — continuing without EIE context:", error);
    return params.basePrompt;
  }
}

export type EieEnrichmentMeta = {
  enabled: boolean;
  conceptSlugs: string[];
};

export async function buildEieEnrichmentMeta(params: {
  project: Project;
  documentType: string;
}): Promise<EieEnrichmentMeta> {
  if (!isEieEnabledForProject(params.project)) {
    return { enabled: false, conceptSlugs: [] };
  }
  try {
    const query = buildSearchQuery(params.project, params.documentType);
    const matches = await searchPublishedByVector(query, 3);
    return {
      enabled: matches.length > 0,
      conceptSlugs: matches.map((m) => m.row.slug),
    };
  } catch {
    return { enabled: false, conceptSlugs: [] };
  }
}
