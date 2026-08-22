import type { ProjectBlueprint, ValidationIssue } from "@/lib/zod/blueprint-schemas";
import type { DocumentSnapshot } from "@/lib/blueprint-engine/validate/readiness";
import { extractExplicitTableReferences } from "@/lib/blueprint-engine/validate/entity-reference-extraction";

const ANTI_DOMAIN_TABLE_PATTERNS = [
  /\bno\s+(?:custom|external|additional)\s+(?:crm\s+)?tables?\b/i,
  /\bdo\s+not\s+(?:introduce|create|add)\s+(?:custom|external|additional)\s+(?:crm\s+)?tables?\b/i,
  /\bwithout\s+(?:introducing|creating|adding)\s+(?:custom|external)\s+tables?\b/i,
  /\bavoid\s+(?:custom|external|additional)\s+(?:crm\s+)?tables?\b/i,
];

const METADATA_AS_DOMAIN_STORE_PATTERNS = [
  /\bstore\s+(?:crm|lead|contact|customer|sales)\s+(?:data|records|information)\s+(?:in|inside|within)\s+(?:agent\s+metadata|tool_executions|workflow_runs)\b/i,
  /\b(?:crm|lead|contact)\s+(?:data|records)\s+(?:in|inside|within)\s+(?:agent\s+metadata|tool_executions|workflow_runs)\b/i,
  /\bpersist\s+(?:leads|contacts|follow.?ups|interactions)\s+(?:in|to)\s+(?:agent\s+metadata|tool_executions|workflow_runs)\b/i,
];

const DOMAIN_TABLE_HINTS = ["contacts", "leads", "follow_ups", "interactions", "content_calendar"];

function semanticError(
  id: string,
  message: string,
  resolution: string,
  documentTypes: string[]
): ValidationIssue {
  return {
    id,
    severity: "error",
    category: "consistency",
    message: message.startsWith("CONSISTENCY ERROR:")
      ? message
      : `CONSISTENCY ERROR: ${message}`,
    resolution,
    documentTypes,
  };
}

function docByType(documents: DocumentSnapshot[], type: string): DocumentSnapshot | undefined {
  return documents.find((doc) => doc.type === type && doc.content?.trim());
}

/** Detect architectural contradictions that entity-name lint cannot catch. */
export function validateSemanticConsistency(
  blueprint: ProjectBlueprint,
  documents: DocumentSnapshot[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const domainTablesInModel = DOMAIN_TABLE_HINTS.filter((table) => blueprint.entities[table]);
  const backend = docByType(documents, "backend_schema");
  const prd = docByType(documents, "prd");
  const appFlow = docByType(documents, "app_flow");

  if (backend?.content) {
    for (const pattern of ANTI_DOMAIN_TABLE_PATTERNS) {
      if (pattern.test(backend.content) && domainTablesInModel.length > 0) {
        issues.push(
          semanticError(
            "CONSISTENCY-SEM-ANTI-DOMAIN-TABLES",
            `backend_schema rejects custom/domain tables but canonical model defines ${domainTablesInModel.join(", ")}`,
            "Define business domain data in dedicated domain tables from the canonical model. Reserve tool_executions and workflow_runs for execution forensics only.",
            ["backend_schema"]
          )
        );
        break;
      }
    }

    for (const pattern of METADATA_AS_DOMAIN_STORE_PATTERNS) {
      if (pattern.test(backend.content)) {
        issues.push(
          semanticError(
            "CONSISTENCY-SEM-METADATA-DOMAIN",
            "backend_schema stores business domain data in agent audit tables instead of domain entities",
            `Persist CRM/sales data in ${domainTablesInModel.join(", ") || "dedicated domain tables"}, not in agent metadata or tool_executions`,
            ["backend_schema"]
          )
        );
        break;
      }
    }
  }

  const domainMentionSources = [prd, appFlow].filter(Boolean) as DocumentSnapshot[];
  const mentionedDomainTables = new Set<string>();

  for (const doc of domainMentionSources) {
    for (const table of extractExplicitTableReferences(doc.content!)) {
      if (DOMAIN_TABLE_HINTS.includes(table)) mentionedDomainTables.add(table);
    }
    for (const table of DOMAIN_TABLE_HINTS) {
      if (new RegExp(`\\b${table}\\b`, "i").test(doc.content!)) {
        mentionedDomainTables.add(table);
      }
    }
  }

  if (backend?.content && mentionedDomainTables.size > 0) {
    const backendTables = new Set(extractExplicitTableReferences(backend.content));
    const missingInSchema = [...mentionedDomainTables].filter(
      (table) => blueprint.entities[table] && !backendTables.has(table)
    );

    if (missingInSchema.length > 0) {
      issues.push(
        semanticError(
          "CONSISTENCY-SEM-PRD-SCHEMA-GAP",
          `PRD/flow documents reference domain tables (${[...mentionedDomainTables].join(", ")}) missing from backend_schema ERD/SQL`,
          `Include CREATE TABLE and ERD definitions for: ${missingInSchema.join(", ")}`,
          ["prd", "app_flow", "backend_schema"]
        )
      );
    }
  }

  if (blueprint.classification.hasAiAgents && !blueprint.entities.workflow_run_events) {
    issues.push({
      id: "CONSISTENCY-SEM-WORKFLOW-EVENTS",
      severity: "warning",
      category: "structural_completeness",
      message:
        "AI agent products should separate mutable workflow_runs from append-only workflow_run_events",
      resolution: "Add workflow_run_events for state transition history; keep workflow_runs as current state",
      documentTypes: ["backend_schema"],
    });
  }

  return issues;
}
