import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("eie rollback SQL", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "docs/eie-rollback.sql"),
    "utf-8"
  );

  it("drops EIE tables in dependency-safe order", () => {
    const tables = [
      "eie_prd_retrievals",
      "eie_concept_relationships",
      "eie_published_knowledge",
      "eie_synthesis_drafts",
      "eie_knowledge_sources",
    ];

    let lastIndex = -1;
    for (const table of tables) {
      const index = sql.indexOf(`DROP TABLE IF EXISTS "${table}"`);
      expect(index).toBeGreaterThan(-1);
      expect(index).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
  });

  it("drops EIE enum types", () => {
    expect(sql).toContain('DROP TYPE IF EXISTS "eie_synthesis_status"');
    expect(sql).toContain('DROP TYPE IF EXISTS "eie_source_type"');
    expect(sql).toContain('DROP TYPE IF EXISTS "eie_source_status"');
  });

  it("does not drop core application tables", () => {
    expect(sql).not.toContain('DROP TABLE IF EXISTS "projects"');
    expect(sql).not.toContain('DROP TABLE IF EXISTS "documents"');
  });
});
