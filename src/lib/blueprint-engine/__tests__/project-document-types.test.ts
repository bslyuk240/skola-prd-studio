import { describe, expect, it } from "vitest";
import {
  PROJECT_DOCUMENT_COUNT,
  PROJECT_DOCUMENT_DEFINITIONS,
  NEW_PROJECT_DOCUMENT_TYPES,
  isProjectDocumentType,
} from "@/lib/project-document-types";
import { BLUEPRINT_DOCUMENT_TYPES } from "@/lib/blueprint-engine/render/document-sections";

describe("project document types", () => {
  it("defines 10 blueprint document placeholders", () => {
    expect(PROJECT_DOCUMENT_COUNT).toBe(10);
    expect(PROJECT_DOCUMENT_DEFINITIONS).toHaveLength(10);
    expect(BLUEPRINT_DOCUMENT_TYPES).toHaveLength(10);
  });

  it("includes the three migration document types", () => {
    expect(NEW_PROJECT_DOCUMENT_TYPES).toEqual([
      "api_integration_spec",
      "testing_qa_plan",
      "deployment_ops_plan",
    ]);

    for (const type of NEW_PROJECT_DOCUMENT_TYPES) {
      expect(PROJECT_DOCUMENT_DEFINITIONS.some((doc) => doc.type === type)).toBe(true);
      expect(isProjectDocumentType(type)).toBe(true);
    }
  });

  it("acceptance gate: each definition has a non-empty title", () => {
    for (const doc of PROJECT_DOCUMENT_DEFINITIONS) {
      expect(doc.title.trim().length).toBeGreaterThan(0);
      expect(isProjectDocumentType(doc.type)).toBe(true);
    }
  });
});
