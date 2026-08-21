import { describe, expect, it } from "vitest";
import {
  canValidateCategory,
  filterIssuesForLifecycle,
} from "@/lib/blueprint-engine/validate/validation-lifecycle";
import {
  classifyIntegration,
  isEmptyIntegrationValue,
  splitIntegrationValues,
} from "@/lib/blueprint-engine/registry/capabilities";

describe("validation lifecycle", () => {
  it("defers schema validation until backend_schema is complete", () => {
    const generating = [{ type: "backend_schema", status: "generating", content: null }];
    expect(canValidateCategory("schema", generating)).toBe(false);

    const ready = [{ type: "backend_schema", status: "ready", content: "CREATE TABLE users..." }];
    expect(canValidateCategory("schema", ready)).toBe(true);
  });

  it("filters schema issues while backend_schema is still generating", () => {
    const issues = [
      {
        id: "STRUCT-entity-users",
        severity: "warning" as const,
        category: "structural_completeness",
        message: "Entity users is referenced but has no complete field definition",
        documentTypes: [],
      },
    ];

    const filtered = filterIssuesForLifecycle(issues, [
      { type: "backend_schema", status: "generating", content: null },
    ]);

    expect(filtered).toHaveLength(0);
  });
});

describe("integration normalization", () => {
  it("treats None and N/A as empty integration values", () => {
    for (const value of ["None", "N/A", "not selected", "no integration"]) {
      expect(isEmptyIntegrationValue(value)).toBe(true);
      expect(splitIntegrationValues(value)).toEqual([]);
    }
  });

  it("recognises known providers without registry warnings", () => {
    expect(classifyIntegration("Gmail").verificationStatus).toBe("verified");
    expect(classifyIntegration("Sentry").verificationStatus).toBe("verified");
    expect(classifyIntegration("Langfuse").verificationStatus).toBe("verified");
  });

  it("marks custom integrations as project_defined", () => {
    const custom = classifyIntegration("JulineMart APIs");
    expect(custom.verificationStatus).toBe("project_defined");
    expect(custom.category).toBe("custom");
    expect(custom.verified).toBe(true);
  });
});
