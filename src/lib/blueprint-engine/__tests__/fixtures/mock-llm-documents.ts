import type { ProjectContext } from "@/lib/ai-prompts";
import type { ProjectBlueprint } from "@/lib/zod/blueprint-schemas";
import type { DocumentSnapshot } from "@/lib/blueprint-engine/validate/readiness";
import { PROJECT_DOCUMENT_DEFINITIONS } from "@/lib/project-document-types";

function entityBlock(blueprint: ProjectBlueprint): string {
  return Object.keys(blueprint.entities).join(", ");
}

function endpointLines(blueprint: ProjectBlueprint, count = 2): string {
  return blueprint.apis
    .slice(0, count)
    .map((api) => `${api.method} ${api.path}`)
    .join(". ");
}

function stateBlock(blueprint: ProjectBlueprint): string {
  const states = blueprint.stateMachines[0]?.states ?? [];
  return states.slice(0, 4).join(", ");
}

/** Deterministic post-LLM document bodies that respect canonical terminology. */
export function buildMockLlmDocuments(
  blueprint: ProjectBlueprint,
  ctx: ProjectContext
): DocumentSnapshot[] {
  const entities = entityBlock(blueprint);
  const endpoints = endpointLines(blueprint);
  const states = stateBlock(blueprint);
  const uploadLine = ctx.fileUpload
    ? "Allowed upload types: PDF and PNG."
    : "";

  return PROJECT_DOCUMENT_DEFINITIONS.map(({ type }) => {
    switch (type) {
      case "prd":
        return {
          type,
          content: `Product scope covers ${entities}. Approvers review agent actions before execution.`,
        };
      case "trd":
        return {
          type,
          content: `Technical design: ${endpoints}. Data model uses ${entities}. Lifecycle: ${states}.`,
        };
      case "app_flow":
        return {
          type,
          content: `Flow from PROPOSED to PENDING_APPROVAL across ${entities}. ${uploadLine}`,
        };
      case "ux_brief":
        return {
          type,
          content: "Design system uses rounded-lg cards, text-sm body, bg-primary actions.",
        };
      case "backend_schema":
        return {
          type,
          content: `Tables: ${entities}. Foreign keys link approval_requests to workflow_runs and tool_executions.`,
        };
      case "implementation_plan":
        return {
          type,
          content: "Phase 1: schema migration. Phase 2: API routes. Phase 3: agent orchestration.",
        };
      case "security_blueprint":
        return {
          type,
          content: `Tenant isolation via RLS. ${uploadLine || "No file upload surface."} Clerk session validation.`,
        };
      case "api_integration_spec":
        return {
          type,
          content: `Shared API catalogue: ${endpoints}. Webhooks verified with signature checks.`,
        };
      case "testing_qa_plan":
        return {
          type,
          content: "Unit tests for state transitions. Integration tests for approval_requests API.",
        };
      case "deployment_ops_plan":
        return {
          type,
          content: "Deploy to Vercel. CI runs lint, typecheck, unit_tests, build.",
        };
      default:
        return { type, content: `Document ${type} references ${entities}.` };
    }
  });
}

/** Mock LLM regen hook — returns canonical-compliant content for critic loop. */
export function createMockGenerateDocument(
  ctx: ProjectContext
): (docType: string, blueprint: ProjectBlueprint) => Promise<string> {
  return async (docType, blueprint) => {
    const doc = buildMockLlmDocuments(blueprint, ctx).find((item) => item.type === docType);
    return doc?.content ?? `Regenerated ${docType} using ${entityBlock(blueprint)}.`;
  };
}
