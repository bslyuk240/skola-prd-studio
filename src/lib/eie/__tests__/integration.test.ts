import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/eie/search", () => ({
  searchPublishedByVector: vi.fn(),
  searchPublished: vi.fn(),
}));

import { searchPublished, searchPublishedByVector } from "@/lib/eie/search";
import { handleQueryEngineeringKnowledge } from "@/lib/eie/mcp-tool";

describe("ingestion and MCP integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns published concepts for MCP searchQuery", async () => {
    vi.mocked(searchPublishedByVector).mockResolvedValue([
      {
        row: {
          id: "1",
          slug: "rbac",
          conceptName: "Role-Based Access Control",
          category: "security_compliance",
          summary: "Assign permissions to roles",
          synthesisDraftId: null,
        } as never,
        score: 0.88,
      },
    ]);

    const result = await handleQueryEngineeringKnowledge({
      searchQuery: "RBAC",
      limit: 5,
    });

    expect(result.totalMatches).toBe(1);
    expect(result.concepts[0]?.slug).toBe("rbac");
    expect(result.concepts[0]).not.toHaveProperty("synthesisDraftId");
  });

  it("falls back to text search when vector search returns no rows", async () => {
    vi.mocked(searchPublishedByVector).mockResolvedValue([]);
    vi.mocked(searchPublished).mockResolvedValue({
      rows: [
        {
          id: "2",
          slug: "jwt-auth",
          conceptName: "JWT Authentication",
          category: "security_compliance",
          summary: "Token-based auth",
          synthesisDraftId: null,
        } as never,
      ],
      total: 1,
    });

    const result = await handleQueryEngineeringKnowledge({
      searchQuery: "JWT",
      limit: 5,
    });

    expect(searchPublished).toHaveBeenCalled();
    expect(result.concepts[0]?.slug).toBe("jwt-auth");
  });
});
