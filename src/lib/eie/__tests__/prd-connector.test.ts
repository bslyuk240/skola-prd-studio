import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Project } from "@/db/schema";

vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

vi.mock("@/lib/eie/search", () => ({
  searchPublishedByVector: vi.fn(),
}));

import { searchPublishedByVector } from "@/lib/eie/search";
import { buildEieContext, enrichPromptWithEie } from "@/lib/eie/prd-connector";

const baseProject = {
  id: "project-1",
  name: "Secure SaaS",
  description: "Multi-tenant app with RBAC",
  securityLevel: "high",
  wizardData: { enableEieCrossReferencing: true },
} as Project;

describe("prd-connector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty context when EIE is disabled", async () => {
    const project = {
      ...baseProject,
      wizardData: { enableEieCrossReferencing: false },
    } as Project;

    const context = await buildEieContext({
      project,
      documentType: "prd",
    });

    expect(context).toBe("");
    expect(searchPublishedByVector).not.toHaveBeenCalled();
  });

  it("builds context block from vector matches", async () => {
    vi.mocked(searchPublishedByVector).mockResolvedValue([
      {
        row: {
          id: "k1",
          slug: "rbac",
          conceptName: "RBAC",
          summary: "Role based access control",
          securityConsiderations: ["Audit role changes"],
          implementationRecommendations: { middleware: "Check roles" },
        } as never,
        score: 0.91,
      },
    ]);

    const context = await buildEieContext({
      project: baseProject,
      documentType: "security_blueprint",
    });

    expect(context).toContain("MANDATORY SYSTEM ARCHITECTURE RULES");
    expect(context).toContain("RBAC");
  });

  it("falls back to base prompt when enrichment throws", async () => {
    vi.mocked(searchPublishedByVector).mockRejectedValue(new Error("search down"));

    const prompt = await enrichPromptWithEie({
      project: baseProject,
      documentType: "prd",
      basePrompt: "Generate PRD",
    });

    expect(prompt).toBe("Generate PRD");
  });
});
