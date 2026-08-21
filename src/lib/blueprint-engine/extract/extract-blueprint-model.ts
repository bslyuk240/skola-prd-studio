import type { ProjectContext } from "@/lib/ai-prompts";
import {
  type ProjectBlueprint,
} from "@/lib/zod/blueprint-schemas";
import { buildBlueprintSeedFromWizard } from "@/lib/blueprint-engine/extract/from-wizard-context";
import { mergeBlueprint, extractJsonObject } from "@/lib/blueprint-engine/extract/merge-blueprint";

const ENRICHMENT_PROMPT = `You are a software architect building a canonical project model for blueprint generation.

Return ONLY valid JSON matching this structure (no markdown prose outside the JSON):
{
  "product": { "name": string, "type": string, "stage": "prototype"|"mvp"|"production"|"enterprise" },
  "entities": { "<table_name>": { "id": "ENT-...", "tableName": "...", "description": "...", "fields": [{"name","type","constraints","description"}], "complete": boolean } },
  "glossary": [{ "canonical": string, "definition": string, "rejectedSynonyms": [string] }],
  "roles": { "<role_key>": { "description": string } },
  "permissions": { "<ROLE>": ["permission.key"] },
  "stateMachines": [{ "id", "name", "states": [], "transitions": [{"from","to","trigger"}], "terminalStates": [] }],
  "apis": [{ "id": "API-001", "method": "POST|GET|...", "path": "/api/...", "purpose": "...", "authRequired": true, "idempotent": false }],
  "integrations": [{ "id": "INT-001", "name", "category", "purpose", "protocol": "HTTPS", "direction": "inbound|outbound|bidirectional", "webhooks": false, "retryPolicy": true, "verified": false }],
  "aiTools": [{ "toolName", "risk": "READ|INTERNAL_WRITE|EXTERNAL_COMMUNICATION|PUBLIC_WRITE|FINANCIAL_WRITE", "approvalRequired": boolean, "idempotencyRequired": boolean }],
  "requirements": {
    "functional": [{ "id": "FR-001", "statement": "...", "priority": "must_have|should_have|could_have", "scope": "required_now|architectural_preparation|future" }],
    "nonFunctional": [string]
  },
  "assumptions": [{ "id": "ASM-001", "statement": "...", "kind": "assumption|target|recommendation|user_requirement|engineering_requirement", "requiresValidation": true, "source": "generated" }]
}

Rules:
- Do NOT rename entities already in the seed glossary/canonical list
- Use snake_case table names consistently
- For AI agent products: include tool_executions, agent_versions, workflow_runs, approval_requests
- Mark KPIs and latency claims as kind "target" or "assumption", not user_requirement
- Do not hard-code LLM model IDs — reference model profiles FAST/BALANCED/REASONING if needed
- Do not invent historical project dates
- permissions matrix must not contradict itself across roles`;

export async function extractBlueprintModel(
  ctx: ProjectContext,
  model?: string
): Promise<ProjectBlueprint> {
  const { generateText, DEFAULT_MODEL } = await import("@/lib/openrouter");
  const seed = buildBlueprintSeedFromWizard(ctx);

  const prompt = `${ENRICHMENT_PROMPT}

APP CONTEXT:
${JSON.stringify(ctx, null, 2)}

EXISTING SEED (extend and complete — do not contradict):
${JSON.stringify(
  {
    product: seed.product,
    classification: seed.classification,
    stack: seed.stack,
    entities: seed.entities,
    glossary: seed.glossary,
    stateMachines: seed.stateMachines,
  },
  null,
  2
)}`;

  const raw = await generateText(prompt, model ?? DEFAULT_MODEL);
  const parsed = extractJsonObject(raw) as Partial<ProjectBlueprint>;
  return mergeBlueprint(seed, parsed);
}

export function buildBlueprintFromWizard(ctx: ProjectContext): ProjectBlueprint {
  return buildBlueprintSeedFromWizard(ctx);
}

export { mergeBlueprint, extractJsonObject } from "@/lib/blueprint-engine/extract/merge-blueprint";
