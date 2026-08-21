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
- Use ONLY canonical entity/table names: ${entities.join(", ") || "(none)"}
- Use ONLY canonical roles: ${roles.join(", ") || "(none)"}
- Do NOT introduce tables, roles, API paths, or integrations absent from the canonical model below
- Reference functional requirements by ID (${blueprint.requirements.functional.map((r) => r.id).join(", ") || "none"})
- Reference API endpoints by stable ID when listing endpoints:
${apiSummary || "- (planned from canonical model)"}
- Functional requirements to trace:
${requirements || "- (none)"}
`.trim();
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
