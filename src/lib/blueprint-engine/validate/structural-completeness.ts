import type { ProjectBlueprint, ValidationIssue } from "@/lib/zod/blueprint-schemas";
import { requirementsMissingTests } from "@/lib/blueprint-engine/plan/qa-planner";
import { extractExplicitTableReferences } from "@/lib/blueprint-engine/validate/entity-reference-extraction";

export function validateStructuralCompleteness(
  blueprint: ProjectBlueprint,
  options: {
    validateEntityFields?: boolean;
    validateIntegrations?: boolean;
  } = {}
): ValidationIssue[] {
  const validateEntityFields = options.validateEntityFields ?? true;
  const validateIntegrations = options.validateIntegrations ?? true;
  const issues: ValidationIssue[] = [];

  if (validateEntityFields) {
    for (const entity of Object.values(blueprint.entities)) {
      if (!entity.complete && entity.fields.length === 0) {
        issues.push({
          id: `STRUCT-entity-${entity.tableName}`,
          severity: "warning",
          category: "structural_completeness",
          message: `Entity "${entity.tableName}" is referenced but has no complete field definition`,
          resolution: "Add full table definition or mark entity as architectural preparation only",
          documentTypes: [],
        });
      }
    }
  }

  if (blueprint.classification.hasAiAgents) {
    const required = [
      "tool_executions",
      "agent_versions",
      "workflow_runs",
      "workflow_run_events",
      "approval_requests",
    ];
    for (const table of required) {
      if (!blueprint.entities[table]) {
        issues.push({
          id: `STRUCT-missing-${table}`,
          severity: "error",
          category: "model_completeness",
          message: `AI agent products require "${table}" in the canonical model`,
          resolution: `Add entities.${table} to the project blueprint`,
          documentTypes: [],
        });
      }
    }
  }

  if (validateIntegrations) {
    for (const integration of blueprint.integrations) {
      if (integration.verificationStatus === "project_defined") {
        issues.push({
          id: `STRUCT-integration-custom-${integration.id}`,
          severity: "warning",
          category: "integration_verification",
          message: `Custom integration "${integration.name}" — capability definition required`,
          resolution:
            "Define what this integration will be used for in the API & Integration Specification",
          documentTypes: ["api_integration_spec"],
        });
        continue;
      }

      if (!integration.verified) {
        issues.push({
          id: `STRUCT-integration-${integration.id}`,
          severity: "warning",
          category: "integration_verification",
          message: `Integration "${integration.name}" is not in the capability registry`,
          resolution: "Verify provider capabilities or mark as VERIFICATION REQUIRED",
          documentTypes: [],
        });
      }
    }
  }

  const missingTests = requirementsMissingTests(blueprint);
  for (const requirementId of missingTests) {
    issues.push({
      id: `QA-missing-${requirementId}`,
      severity: "error",
      category: "qa_coverage",
      message: `Requirement "${requirementId}" has no linked test case`,
      resolution: `Add at least one test case with requirementId "${requirementId}"`,
      documentTypes: ["testing_qa_plan"],
    });
  }

  return issues;
}

export function validateEntityReferencesInText(
  blueprint: ProjectBlueprint,
  text: string,
  documentType: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const canonicalNames = new Set(Object.keys(blueprint.entities));
  const mentioned = extractExplicitTableReferences(text);

  for (const name of mentioned) {
    if (canonicalNames.has(name)) continue;

    const rejected = blueprint.glossary.flatMap((g) => g.rejectedSynonyms);
    if (rejected.includes(name)) {
      const entry = blueprint.glossary.find((g) => g.rejectedSynonyms.includes(name));
      issues.push({
        id: `ENTITY-REF-${name}`,
        severity: "error",
        category: "terminology",
        message: `Document uses rejected entity name "${name}" — canonical is "${entry?.canonical}"`,
        documentTypes: [documentType],
        resolution: `Rename "${name}" to "${entry?.canonical}"`,
      });
      continue;
    }

    issues.push({
      id: `ENTITY-UNKNOWN-${name}`,
      severity: "error",
      category: "entity_registry",
      message: `Document references unknown table "${name}" not in the canonical model`,
      documentTypes: [documentType],
      resolution: `Remove "${name}" or add it to the project blueprint entity registry`,
    });
  }

  return issues;
}
