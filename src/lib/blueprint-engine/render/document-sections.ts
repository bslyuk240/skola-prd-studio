import type { ProjectBlueprint } from "@/lib/zod/blueprint-schemas";

export type BlueprintDocumentType =
  | "prd"
  | "trd"
  | "app_flow"
  | "ux_brief"
  | "backend_schema"
  | "implementation_plan"
  | "security_blueprint"
  | "api_integration_spec"
  | "testing_qa_plan"
  | "deployment_ops_plan";

export const BLUEPRINT_DOCUMENT_TYPES: BlueprintDocumentType[] = [
  "prd",
  "trd",
  "app_flow",
  "ux_brief",
  "backend_schema",
  "implementation_plan",
  "security_blueprint",
  "api_integration_spec",
  "testing_qa_plan",
  "deployment_ops_plan",
];

/** Blueprint sections injected per document type (P5-1). */
export const DOCUMENT_SECTIONS: Record<
  BlueprintDocumentType,
  (keyof ProjectBlueprint)[]
> = {
  prd: ["product", "requirements", "roles", "classification", "assumptions"],
  trd: [
    "product",
    "stack",
    "entities",
    "apis",
    "integrations",
    "webhooks",
    "deployment",
  ],
  app_flow: ["product", "roles", "workflows", "stateMachines", "classification"],
  ux_brief: ["product", "roles", "classification", "glossary"],
  backend_schema: ["entities", "stack", "apis", "glossary", "permissions"],
  implementation_plan: [
    "product",
    "stack",
    "requirements",
    "deployment",
    "testing",
    "classification",
  ],
  security_blueprint: [
    "product",
    "permissions",
    "roles",
    "aiTools",
    "classification",
    "stack",
    "stateMachines",
  ],
  api_integration_spec: ["apis", "integrations", "webhooks", "stack", "entities"],
  testing_qa_plan: ["requirements", "testing", "apis", "classification"],
  deployment_ops_plan: ["deployment", "stack", "integrations", "product"],
};

export function getSectionsForDocument(
  docType: BlueprintDocumentType
): (keyof ProjectBlueprint)[] {
  return DOCUMENT_SECTIONS[docType];
}

export function isBlueprintDocumentType(value: string): value is BlueprintDocumentType {
  return BLUEPRINT_DOCUMENT_TYPES.includes(value as BlueprintDocumentType);
}
