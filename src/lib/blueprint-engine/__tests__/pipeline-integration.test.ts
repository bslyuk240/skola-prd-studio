import { describe, expect, it } from "vitest";
import { buildBlueprintSeedFromWizard } from "@/lib/blueprint-engine/extract/from-wizard-context";
import { renderDocument } from "@/lib/blueprint-engine/render/render-document";
import { runArchitectCritic } from "@/lib/blueprint-engine/critic/critic-orchestrator";
import { runBlueprintValidation } from "@/lib/blueprint-engine/validate/readiness";
import { validateCrossDocumentConsistency } from "@/lib/blueprint-engine/validate/consistency-validator";
import { sanitizeDocumentsCodeSnippets } from "@/lib/blueprint-engine/validate/code-snippet-qa";
import { enforceTerminologyOnContent } from "@/lib/blueprint-engine/validate/enforce-terminology";
import { enforceStackLockInText } from "@/lib/blueprint-engine/validate/stack-lock";
import { PROJECT_DOCUMENT_DEFINITIONS } from "@/lib/project-document-types";
import { AI_AGENT_SAAS_WIZARD_INPUT } from "@/lib/blueprint-engine/__tests__/fixtures/ai-agent-saas-golden";
import {
  buildMockLlmDocuments,
  createMockGenerateDocument,
} from "@/lib/blueprint-engine/__tests__/fixtures/mock-llm-documents";

describe("blueprint pipeline integration (mocked LLM)", () => {
  it("runs seed → render prompts → mock LLM → critic → snippet QA → validation", async () => {
    const ctx = AI_AGENT_SAAS_WIZARD_INPUT;
    const blueprint = buildBlueprintSeedFromWizard(ctx);

    for (const { type } of PROJECT_DOCUMENT_DEFINITIONS) {
      const prompt = renderDocument(type, blueprint, ctx);
      expect(prompt.length).toBeGreaterThan(200);
      expect(prompt).toContain(ctx.appName ?? "Skola Workforce");
    }

    const mockLlmOutput = buildMockLlmDocuments(blueprint, ctx);
    expect(mockLlmOutput).toHaveLength(PROJECT_DOCUMENT_DEFINITIONS.length);

    const postProcess = mockLlmOutput.map((doc) => ({
      type: doc.type,
      content: enforceStackLockInText(
        enforceTerminologyOnContent(blueprint, doc.content, doc.type).content,
        blueprint
      ),
    }));

    const criticResult = await runArchitectCritic({
      blueprint,
      documents: postProcess,
      generateDocument: createMockGenerateDocument(ctx),
      maxIterations: 2,
    });

    const { documents: sanitized, issues: snippetIssues } =
      sanitizeDocumentsCodeSnippets(criticResult.documents);

    const consistencyIssues = validateCrossDocumentConsistency(criticResult.blueprint, sanitized);
    const { breakdown, issues } = runBlueprintValidation(criticResult.blueprint, sanitized);

    expect(criticResult.iterations).toBeGreaterThanOrEqual(0);
    expect(sanitized.length).toBe(PROJECT_DOCUMENT_DEFINITIONS.length);
    expect(breakdown.overall).toBeGreaterThan(0);
    expect(
      issues.filter((issue) => issue.category === "terminology" && issue.severity === "error")
    ).toHaveLength(0);
    expect(
      consistencyIssues.filter(
        (issue) => issue.category === "consistency" && issue.severity === "error"
      )
    ).toHaveLength(0);
    expect(snippetIssues.every((issue) => issue.severity !== "error")).toBe(true);
  });

  it("recovers from injected terminology drift via critic regen", async () => {
    const ctx = AI_AGENT_SAAS_WIZARD_INPUT;
    const blueprint = buildBlueprintSeedFromWizard(ctx);

    const drifted = buildMockLlmDocuments(blueprint, ctx).map((doc) =>
      doc.type === "backend_schema"
        ? {
            ...doc,
            content:
              "The approval_tasks table stores agent_runs linked to job_runs before tool_calls execute.",
          }
        : doc
    );

    const criticResult = await runArchitectCritic({
      blueprint,
      documents: drifted,
      generateDocument: createMockGenerateDocument(ctx),
      maxIterations: 2,
    });

    const backend = criticResult.documents.find((doc) => doc.type === "backend_schema");
    expect(backend?.content).toContain("approval_requests");
    expect(backend?.content).not.toMatch(/\bapproval_tasks\b/);

    const validation = runBlueprintValidation(criticResult.blueprint, criticResult.documents);
    expect(
      validation.issues.filter(
        (issue) => issue.category === "terminology" && issue.severity === "error"
      )
    ).toHaveLength(0);
  });
});
