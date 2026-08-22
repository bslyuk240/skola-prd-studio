import type { ProjectBlueprint } from "@/lib/zod/blueprint-schemas";

type EntityField = ProjectBlueprint["entities"][string]["fields"][number];

const TEMPLATE_FIELDS: Record<string, EntityField[]> = {
  approval_requests: [
    { name: "organization_id", type: "uuid", constraints: "NOT NULL, FK organizations" },
    { name: "workflow_run_id", type: "uuid", constraints: "nullable, FK workflow_runs" },
    { name: "requested_by_agent_id", type: "uuid", constraints: "nullable, FK agents" },
    { name: "action_type", type: "text", constraints: "NOT NULL" },
    { name: "proposed_action_payload", type: "jsonb", constraints: "NOT NULL" },
    { name: "approved_action_payload", type: "jsonb", constraints: "nullable, immutable after approval" },
    { name: "payload_hash", type: "text", constraints: "NOT NULL, SHA-256 of canonical payload" },
    { name: "revision", type: "integer", constraints: "NOT NULL DEFAULT 1" },
    { name: "status", type: "text", constraints: "NOT NULL" },
    { name: "reviewed_by_user_id", type: "uuid", constraints: "nullable, FK users" },
    { name: "reviewed_at", type: "timestamptz", constraints: "nullable" },
  ],
  workflow_runs: [
    { name: "organization_id", type: "uuid", constraints: "NOT NULL, FK organizations" },
    { name: "agent_id", type: "uuid", constraints: "nullable, FK agents" },
    { name: "agent_version_id", type: "uuid", constraints: "nullable, FK agent_versions" },
    { name: "status", type: "text", constraints: "NOT NULL, mutable current state" },
    { name: "current_step", type: "text", constraints: "nullable" },
    { name: "idempotency_key", type: "text", constraints: "nullable, UNIQUE per org+workflow" },
    { name: "started_at", type: "timestamptz", constraints: "nullable" },
    { name: "ended_at", type: "timestamptz", constraints: "nullable" },
  ],
  tool_executions: [
    { name: "organization_id", type: "uuid", constraints: "NOT NULL, FK organizations" },
    { name: "workflow_run_id", type: "uuid", constraints: "NOT NULL, FK workflow_runs" },
    { name: "tool_name", type: "text", constraints: "NOT NULL" },
    { name: "idempotency_key", type: "text", constraints: "NOT NULL when retries/external writes enabled" },
    { name: "execution_status", type: "text", constraints: "NOT NULL" },
    { name: "input_parameters", type: "jsonb", constraints: "nullable" },
    { name: "output_response", type: "jsonb", constraints: "nullable" },
    { name: "executed_at", type: "timestamptz", constraints: "NOT NULL DEFAULT now()" },
  ],
  agent_versions: [
    { name: "agent_id", type: "uuid", constraints: "NOT NULL, FK agents" },
    { name: "version_number", type: "integer", constraints: "NOT NULL" },
    { name: "system_prompt", type: "text", constraints: "NOT NULL" },
    { name: "model_profile", type: "text", constraints: "NOT NULL" },
    { name: "revision_hash", type: "text", constraints: "NOT NULL" },
    { name: "created_at", type: "timestamptz", constraints: "NOT NULL DEFAULT now()" },
  ],
};

/** Apply canonical field templates to core entities when fields are still empty. */
export function applyEntityFieldTemplates(blueprint: ProjectBlueprint): ProjectBlueprint {
  const entities = { ...blueprint.entities };

  for (const [tableName, fields] of Object.entries(TEMPLATE_FIELDS)) {
    const existing = entities[tableName];
    if (!existing || existing.fields.length > 0) continue;
    entities[tableName] = {
      ...existing,
      fields,
      complete: true,
    };
  }

  return { ...blueprint, entities };
}

export function missingTemplateFields(blueprint: ProjectBlueprint): string[] {
  const missing: string[] = [];
  for (const tableName of Object.keys(TEMPLATE_FIELDS)) {
    const entity = blueprint.entities[tableName];
    if (!entity) continue;
    if (entity.fields.length === 0) missing.push(tableName);
  }
  return missing;
}
