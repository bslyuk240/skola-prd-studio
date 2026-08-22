import type { ProjectBlueprint } from "@/lib/zod/blueprint-schemas";
import type { BlueprintDocumentType } from "@/lib/blueprint-engine/render/document-sections";

export function buildModelBindingBlock(
  blueprint: ProjectBlueprint,
  docType: BlueprintDocumentType
): string {
  const entities = Object.keys(blueprint.entities);
  const roles = Object.keys(blueprint.roles);
  const apiSummary = blueprint.apis
    .slice(0, 12)
    .map((api) => `- ${api.id}: ${api.method} ${api.path} — ${api.purpose}`)
    .join("\n");
  const requirements = blueprint.requirements.functional
    .slice(0, 12)
    .map((req) => `- ${req.id}: ${req.statement}`)
    .join("\n");

  return `
MODEL-DRIVEN RENDER RULES (${docType}):
- Canonical entity/table names include core platform tables AND domain tables listed below: ${entities.join(", ") || "(none)"}
- Use ONLY canonical roles: ${roles.join(", ") || "(none)"}
- Do NOT invent alternate table names for entities already in the canonical model
- You MAY reference any table in the canonical entity registry — domain/business tables are first-class, not exceptions
- Do NOT store business domain data (CRM, leads, contacts, calendar content) inside agent metadata, tool_executions, or workflow_runs — those tables are for execution forensics and current run state only
- Reference functional requirements by ID (${blueprint.requirements.functional.map((r) => r.id).join(", ") || "none"})
- Reference API endpoints by stable ID when listing endpoints:
${apiSummary || "- (planned from canonical model)"}
- Functional requirements to trace:
${requirements || "- (none)"}
${buildSchemaArchitectureRules(blueprint, docType)}
`.trim();
}

export function buildSchemaArchitectureRules(
  blueprint: ProjectBlueprint,
  docType: BlueprintDocumentType
): string {
  if (docType !== "backend_schema" && docType !== "trd" && docType !== "prd") return "";

  const domainTables = Object.keys(blueprint.entities).filter(
    (name) =>
      ![
        "users",
        "organizations",
        "organization_memberships",
        "agents",
        "agent_versions",
        "workflow_runs",
        "workflow_run_events",
        "tool_executions",
        "approval_requests",
      ].includes(name)
  );

  const lines = [
    "SCHEMA ARCHITECTURE RULES:",
    "- users = global identity; organization_memberships = tenant role and access",
    "- workflow_runs = mutable current execution state; workflow_run_events = append-only transition history",
    "- approval_requests must store proposed_action_payload, approved_action_payload, payload_hash, and revision for immutable approval integrity",
    "- tool_executions and workflow_runs require idempotency_key when retries or external writes are enabled",
  ];

  if (blueprint.policyEngine?.enabled) {
    lines.push(
      "- Policy Engine evaluates authorization, risk, autonomy, and approval routing before tool execution (document as a first-class component)"
    );
  }

  if (domainTables.length > 0) {
    lines.push(
      `- Domain/business tables (${domainTables.join(", ")}) MUST have full CREATE TABLE definitions — never replace them with audit-table storage`
    );
  }

  return lines.join("\n");
}

export function buildGanttTimelineRules(blueprint: ProjectBlueprint): string {
  if (blueprint.metadata.projectStartDate) {
    return `Gantt chart: use dateFormat YYYY-MM-DD starting from projectStartDate ${blueprint.metadata.projectStartDate}.`;
  }
  return `Gantt chart: use Week 1, Week 2, Week 3 task labels — do NOT use calendar years or 2024 dates. Example task: "Project initialisation :a1, Week 1, 2d".`;
}

export function buildImplementationPhaseOrderRules(blueprint: ProjectBlueprint): string {
  if (!blueprint.classification.hasAiAgents) return "";

  return `
IMPLEMENTATION ORDER (mandatory for AI-agent products):
- Complete foundational security (auth, RBAC, tenant isolation) BEFORE agent automation features
- Implement approval_requests workflow before tool_executions processing
- Phase 7 (Security Implementation) must precede agent/workflow feature phases in the build plan
- Do not schedule agent tool execution until approval_requests and tool_executions audit tables exist
`.trim();
}

export function buildStateMachineBinding(blueprint: ProjectBlueprint): string {
  if (blueprint.stateMachines.length === 0) return "";
  const machines = blueprint.stateMachines
    .map(
      (sm) =>
        `- ${sm.id} (${sm.name}): states ${sm.states.join(" → ")}; terminal: ${sm.terminalStates.join(", ")}`
    )
    .join("\n");
  return `State machines (use these exact state names):\n${machines}`;
}
