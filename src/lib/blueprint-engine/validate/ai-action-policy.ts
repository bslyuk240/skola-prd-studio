import type { ProjectBlueprint, ValidationIssue } from "@/lib/zod/blueprint-schemas";
import type { z } from "zod";
import type { aiToolPolicySchema, toolRiskLevelSchema } from "@/lib/zod/blueprint-schemas";
import type { DocumentSnapshot } from "@/lib/blueprint-engine/validate/readiness";

type AiToolPolicy = z.infer<typeof aiToolPolicySchema>;
type ToolRisk = z.infer<typeof toolRiskLevelSchema>;

export const DEFAULT_AUTHORIZATION_CHAIN = [
  "schema_validation",
  "authentication",
  "authorization",
  "tenant_scope_check",
  "tool_risk_classification",
  "approval_gate",
  "idempotency_check",
  "execution",
  "audit_log_write",
] as const;

const HIGH_RISK_LEVELS: ToolRisk[] = [
  "EXTERNAL_COMMUNICATION",
  "PUBLIC_WRITE",
  "FINANCIAL_WRITE",
];

const WRITE_RISK_LEVELS: ToolRisk[] = ["INTERNAL_WRITE", ...HIGH_RISK_LEVELS];

function policyIssue(
  id: string,
  message: string,
  resolution: string,
  documentTypes: string[] = []
): ValidationIssue {
  return {
    id,
    severity: "error",
    category: "ai_action_policy",
    message: message.startsWith("AI POLICY ERROR:") ? message : `AI POLICY ERROR: ${message}`,
    resolution,
    documentTypes,
  };
}

function requiresApproval(risk: ToolRisk): boolean {
  return HIGH_RISK_LEVELS.includes(risk);
}

function requiresIdempotency(risk: ToolRisk): boolean {
  return WRITE_RISK_LEVELS.includes(risk);
}

/** Ensure default AI tool policies exist for agent products (P7-3). */
export function planAiToolPolicies(blueprint: ProjectBlueprint): ProjectBlueprint {
  if (!blueprint.classification.hasAiAgents) return blueprint;

  const existing = [...blueprint.aiTools];
  const byName = new Set(existing.map((tool) => tool.toolName));

  const defaults: AiToolPolicy[] = [
    {
      toolName: "read_internal_data",
      risk: "READ",
      approvalRequired: false,
      idempotencyRequired: false,
    },
    {
      toolName: "write_internal_record",
      risk: "INTERNAL_WRITE",
      approvalRequired: false,
      idempotencyRequired: true,
    },
    {
      toolName: "send_external_message",
      risk: "EXTERNAL_COMMUNICATION",
      approvalRequired: true,
      idempotencyRequired: true,
    },
    {
      toolName: "publish_public_content",
      risk: "PUBLIC_WRITE",
      approvalRequired: true,
      idempotencyRequired: true,
    },
    {
      toolName: "charge_payment",
      risk: "FINANCIAL_WRITE",
      approvalRequired: true,
      idempotencyRequired: true,
    },
  ];

  for (const tool of defaults) {
    if (!byName.has(tool.toolName)) {
      existing.push(tool);
      byName.add(tool.toolName);
    }
  }

  return {
    ...blueprint,
    aiTools: existing,
    aiActionPolicy: blueprint.aiActionPolicy ?? {
      authorizationChain: [...DEFAULT_AUTHORIZATION_CHAIN],
      schemaValidationIsNotAuthorization: true,
    },
  };
}

/** Validate tool risk taxonomy and idempotency requirements (P7-3, P7-5). */
export function validateAiToolPolicies(blueprint: ProjectBlueprint): ValidationIssue[] {
  if (!blueprint.classification.hasAiAgents) return [];

  const issues: ValidationIssue[] = [];

  if (blueprint.aiTools.length === 0) {
    issues.push(
      policyIssue(
        "AI-POLICY-NO-TOOLS",
        "AI agent products require aiTools policy entries",
        "Add aiTools with risk classifications READ through FINANCIAL_WRITE",
        []
      )
    );
  }

  for (const tool of blueprint.aiTools) {
    if (requiresApproval(tool.risk) && !tool.approvalRequired) {
      issues.push(
        policyIssue(
          `AI-POLICY-APPROVAL-${tool.toolName}`,
          `Tool "${tool.toolName}" with risk ${tool.risk} must set approvalRequired=true`,
          "Require human approval for EXTERNAL_COMMUNICATION, PUBLIC_WRITE, and FINANCIAL_WRITE tools",
          []
        )
      );
    }

    if (requiresIdempotency(tool.risk) && !tool.idempotencyRequired) {
      issues.push(
        policyIssue(
          `AI-POLICY-IDEMPOTENCY-${tool.toolName}`,
          `Tool "${tool.toolName}" with risk ${tool.risk} must set idempotencyRequired=true`,
          "Design idempotency_key handling for mutating tools with retry support",
          []
        )
      );
    }
  }

  for (const integration of blueprint.integrations) {
    if (!integration.retryPolicy) continue;
    const linkedTool = blueprint.aiTools.find((tool) =>
      tool.toolName.toLowerCase().includes(integration.name.toLowerCase().split(" ")[0] ?? "")
    );
    if (linkedTool && requiresIdempotency(linkedTool.risk) && !linkedTool.idempotencyRequired) {
      issues.push(
        policyIssue(
          `AI-POLICY-RETRY-IDEMPOTENCY-${integration.id}`,
          `Integration "${integration.name}" has retryPolicy but linked tool lacks idempotencyRequired`,
          "External mutations with retries must declare idempotency_key design",
          []
        )
      );
    }
  }

  const chain = blueprint.aiActionPolicy?.authorizationChain ?? DEFAULT_AUTHORIZATION_CHAIN;
  if (chain.length < DEFAULT_AUTHORIZATION_CHAIN.length) {
    issues.push(
      policyIssue(
        "AI-POLICY-CHAIN-LENGTH",
        "AI action authorization chain is incomplete",
        `Include all steps: ${DEFAULT_AUTHORIZATION_CHAIN.join(" → ")}`,
        []
      )
    );
  }

  if (
    blueprint.aiActionPolicy &&
    !blueprint.aiActionPolicy.schemaValidationIsNotAuthorization
  ) {
    issues.push(
      policyIssue(
        "AI-POLICY-SCHEMA-AUTH",
        "schemaValidationIsNotAuthorization must remain true",
        "Schema validation alone must never grant authorization to execute tools",
        []
      )
    );
  }

  return issues;
}

/** Validate generated docs respect the 9-step authorization model (P7-4). */
export function validateAiPolicyInDocument(
  blueprint: ProjectBlueprint,
  content: string,
  documentType: string
): ValidationIssue[] {
  if (!blueprint.classification.hasAiAgents) return [];
  if (documentType !== "security_blueprint" && documentType !== "app_flow" && documentType !== "trd") {
    return [];
  }

  const issues: ValidationIssue[] = [];
  const lower = content.toLowerCase();

  if (
    /schema validation (?:alone )?(?:is )?(?:sufficient|enough|authoriz)/i.test(content) ||
    /validated input (?:automatically )?(?:executes|runs|triggers)/i.test(content)
  ) {
    issues.push(
      policyIssue(
        `AI-POLICY-DOC-SCHEMA-${documentType}`,
        `${documentType} implies schema validation equals authorization`,
        "Document the 9-step authorization chain — schema validation is step 1 only",
        [documentType]
      )
    );
  }

  const chain = blueprint.aiActionPolicy?.authorizationChain ?? DEFAULT_AUTHORIZATION_CHAIN;
  const missingSteps = chain.filter(
    (step) => !lower.includes(step.replace(/_/g, " ")) && !lower.includes(step)
  );
  if (
    documentType === "security_blueprint" &&
    missingSteps.length > chain.length - 3
  ) {
    issues.push(
      policyIssue(
        `AI-POLICY-DOC-CHAIN-${documentType}`,
        "Security blueprint missing AI action authorization chain steps",
        `Document steps: ${chain.join(" → ")}`,
        [documentType]
      )
    );
  }

  return issues;
}

export function validateAiActionPolicy(
  blueprint: ProjectBlueprint,
  documents: DocumentSnapshot[] = []
): ValidationIssue[] {
  const issues = validateAiToolPolicies(blueprint);

  for (const doc of documents) {
    if (!doc.content?.trim()) continue;
    issues.push(...validateAiPolicyInDocument(blueprint, doc.content, doc.type));
  }

  return issues;
}

export function aiPolicyErrorsForDocument(
  issues: ValidationIssue[],
  documentType: string
): ValidationIssue[] {
  return issues.filter(
    (issue) =>
      issue.category === "ai_action_policy" &&
      issue.severity === "error" &&
      issue.documentTypes.includes(documentType)
  );
}
