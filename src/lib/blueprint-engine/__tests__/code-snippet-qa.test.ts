import { describe, expect, it } from "vitest";
import { buildBlueprintSeedFromWizard } from "@/lib/blueprint-engine/extract/from-wizard-context";
import { applyGlossaryToBlueprint } from "@/lib/blueprint-engine/registry/glossary-builder";
import { finalizeBlueprint } from "@/lib/blueprint-engine/plan/finalize-blueprint";
import { buildIntegrityReport } from "@/lib/blueprint-engine/integrity-report";
import {
  extractFencedCodeBlocks,
  stripInvalidCodeSnippets,
  validateCodeSnippet,
  validateJson,
  validateMermaid,
  validateSql,
  validateTypeScript,
} from "@/lib/blueprint-engine/validate/code-snippet-qa";
import type { ProjectContext } from "@/lib/ai-prompts";

const INVALID_MERMAID = `\`\`\`mermaid
graph TD
  A -->
\`\`\``;

const VALID_MERMAID = `\`\`\`mermaid
graph TD
  A --> B
\`\`\``;

describe("code snippet QA", () => {
  it("extracts fenced code blocks with language and line numbers", () => {
    const content = `# Architecture\n\n${VALID_MERMAID}\n\nMore text`;
    const blocks = extractFencedCodeBlocks(content);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.language).toBe("mermaid");
    expect(blocks[0]?.code.trim()).toBe("graph TD\n  A --> B");
    expect(blocks[0]?.lineNumber).toBe(3);
  });

  it("flags invalid Mermaid diagrams", () => {
    expect(validateMermaid("graph TD\n  A -->")).toMatch(/Incomplete edge/);
    expect(validateMermaid("not a diagram")).toMatch(/Unrecognized Mermaid/);
    expect(validateMermaid("graph TD\n  A --> B")).toBeNull();
  });

  it("flags invalid SQL, JSON, and TypeScript snippets", () => {
    expect(validateSql("SELECT id FROM users WHERE name = 'open")).toMatch(/Unclosed/);
    expect(validateJson('{ "name": "demo", }')).toMatch(/JSON/i);
    expect(validateTypeScript("const value: string = ;")).toMatch(/Line 1/);
  });

  it("strips invalid snippets and leaves a removal notice", () => {
    const content = `# Flow\n\n${INVALID_MERMAID}\n\nAfter diagram`;
    const result = stripInvalidCodeSnippets(content, "app_flow");

    expect(result.content).not.toContain("```mermaid");
    expect(result.content).toContain("Code snippet removed");
    expect(result.content).toContain("After diagram");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.severity).toBe("warning");
    expect(result.issues[0]?.category).toBe("code_snippets");
  });

  it("acceptance gate: invalid Mermaid fixture is flagged, not shipped as-is", () => {
    const raw = `# System diagram\n\n${INVALID_MERMAID}`;
    const sanitized = stripInvalidCodeSnippets(raw, "trd");

    expect(sanitized.content).not.toMatch(/```mermaid[\s\S]*A -->/);
    expect(validateCodeSnippet("mermaid", "graph TD\n  A -->").valid).toBe(false);

    const ctx: ProjectContext = {
      appName: "Snippet QA App",
      shortDescription: "Validates generated snippets",
      mainFeatures: "Dashboard",
    };
    const blueprint = finalizeBlueprint(applyGlossaryToBlueprint(buildBlueprintSeedFromWizard(ctx)), ctx);
    const report = buildIntegrityReport(blueprint, [
      { type: "trd", content: raw },
      { type: "trd", content: sanitized.content },
    ]);

    const snippetWarnings = report.issues.filter((issue) => issue.category === "code_snippets");
    expect(snippetWarnings.length).toBeGreaterThan(0);
    expect(snippetWarnings[0]?.severity).toBe("warning");
    expect(report.status).toBe("warning");
  });
});
