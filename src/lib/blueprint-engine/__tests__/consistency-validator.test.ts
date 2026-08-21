import { describe, expect, it } from "vitest";
import { buildBlueprintSeedFromWizard } from "@/lib/blueprint-engine/extract/from-wizard-context";
import { finalizeBlueprint } from "@/lib/blueprint-engine/plan/finalize-blueprint";
import {
  extractClaimsFromDocument,
  extractUploadTypes,
} from "@/lib/blueprint-engine/validate/extract-claims";
import {
  validateCrossDocumentConsistency,
  hasBlockingConsistencyErrors,
} from "@/lib/blueprint-engine/validate/consistency-validator";
import type { ProjectContext } from "@/lib/ai-prompts";

const ctx: ProjectContext = {
  appName: "Skola Workforce",
  shortDescription: "AI agent platform",
  mainFeatures: "Upload employee documents",
  fileUpload: true,
  multiTenancy: true,
};

const APP_FLOW_UPLOAD = `
## Upload Flow
Users may upload .pdf and .png files for employee records.
Allowed types: PDF, PNG.
`;

const SECURITY_UPLOAD_CONFLICT = `
## File Upload Security
Allowed upload types: PDF, CSV, and Excel (.xlsx) only.
Validate MIME types application/pdf and text/csv server-side.
`;

describe("extractClaimsFromDocument", () => {
  it("extracts normalized upload types from documents", () => {
    expect(extractUploadTypes(APP_FLOW_UPLOAD)).toEqual(["pdf", "png"]);
    expect(extractUploadTypes(SECURITY_UPLOAD_CONFLICT)).toEqual(["csv", "pdf", "xlsx"]);
  });

  it("extracts API endpoints and states", () => {
    const claims = extractClaimsFromDocument(
      "trd",
      "POST /api/approval_requests creates a request. State moves to PENDING_APPROVAL then APPROVED."
    );
    expect(claims.endpoints[0]).toEqual({
      method: "POST",
      path: "/api/approval_requests",
    });
    expect(claims.states).toContain("PENDING_APPROVAL");
  });
});

describe("cross-document consistency", () => {
  it("detects upload-type conflict between app flow and security blueprint", () => {
    const blueprint = finalizeBlueprint(buildBlueprintSeedFromWizard(ctx), ctx);
    const issues = validateCrossDocumentConsistency(blueprint, [
      { type: "app_flow", content: APP_FLOW_UPLOAD },
      { type: "security_blueprint", content: SECURITY_UPLOAD_CONFLICT },
    ]);

    expect(hasBlockingConsistencyErrors(issues)).toBe(true);
    expect(
      issues.some(
        (issue) =>
          issue.category === "consistency" &&
          issue.message.includes("Upload types differ") &&
          issue.message.includes("CONSISTENCY ERROR")
      )
    ).toBe(true);
    expect(issues[0]?.resolution).toContain("Align allowed upload");
  });

  it("passes when upload types match across documents", () => {
    const blueprint = finalizeBlueprint(buildBlueprintSeedFromWizard(ctx), ctx);
    const issues = validateCrossDocumentConsistency(blueprint, [
      { type: "app_flow", content: APP_FLOW_UPLOAD },
      {
        type: "security_blueprint",
        content: "Allowed upload types: PDF and PNG with magic-byte validation.",
      },
    ]);

    expect(issues.some((issue) => issue.message.includes("Upload types differ"))).toBe(false);
  });
});
