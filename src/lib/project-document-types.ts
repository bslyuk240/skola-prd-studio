import { z } from "zod";
import {
  BLUEPRINT_DOCUMENT_TYPES,
  type BlueprintDocumentType,
} from "@/lib/blueprint-engine/render/document-sections";

export type ProjectDocumentType = BlueprintDocumentType;

export const PROJECT_DOCUMENT_COUNT = BLUEPRINT_DOCUMENT_TYPES.length;

const PROJECT_DOCUMENT_TITLES: Record<BlueprintDocumentType, string> = {
  prd: "Product Requirements Document",
  trd: "Technical Requirements Document",
  app_flow: "App Flow",
  ux_brief: "UI/UX Design Brief",
  backend_schema: "Backend Schema",
  implementation_plan: "Implementation Plan",
  security_blueprint: "Security Blueprint",
  api_integration_spec: "API & Integration Specification",
  testing_qa_plan: "Testing & QA Plan",
  deployment_ops_plan: "Deployment & Operations Plan",
};

export const PROJECT_DOCUMENT_DEFINITIONS = BLUEPRINT_DOCUMENT_TYPES.map((type) => ({
  type,
  title: PROJECT_DOCUMENT_TITLES[type],
}));

export const PROJECT_DOCUMENT_TYPE_VALUES = BLUEPRINT_DOCUMENT_TYPES as unknown as readonly [
  ProjectDocumentType,
  ...ProjectDocumentType[],
];

export const projectDocumentTypeSchema = z.enum(
  PROJECT_DOCUMENT_TYPE_VALUES as [ProjectDocumentType, ...ProjectDocumentType[]]
);

export const PROJECT_DOCUMENT_TITLES_BY_TYPE = PROJECT_DOCUMENT_TITLES;

export function isProjectDocumentType(value: string): value is ProjectDocumentType {
  return (BLUEPRINT_DOCUMENT_TYPES as readonly string[]).includes(value);
}

/** Document types added in the 7 → 10 doc migration. */
export const NEW_PROJECT_DOCUMENT_TYPES: ProjectDocumentType[] = [
  "api_integration_spec",
  "testing_qa_plan",
  "deployment_ops_plan",
];
