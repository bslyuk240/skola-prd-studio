import { describe, expect, it } from "vitest";
import {
  extractExplicitTableReferences,
  filterWorkflowStates,
  isLikelyEnvironmentVariable,
} from "@/lib/blueprint-engine/validate/entity-reference-extraction";
import { extractStates } from "@/lib/blueprint-engine/validate/extract-claims";
import { validateEntityReferencesInText } from "@/lib/blueprint-engine/validate/structural-completeness";
import type { ProjectBlueprint } from "@/lib/zod/blueprint-schemas";

const minimalBlueprint = {
  entities: {
    users: { tableName: "users", complete: false, fields: [] },
    agents: { tableName: "agents", complete: false, fields: [] },
  },
  glossary: [],
} as unknown as ProjectBlueprint;

describe("entity-reference-extraction", () => {
  it("extracts only explicit SQL table references", () => {
    const text = `
      The team_member role can view ai_workforce_dashboard.
      CREATE TABLE workflow_runs (id uuid);
      SELECT * FROM \`approval_requests\`;
      clerk_secret_key env var.
    `;
    const refs = extractExplicitTableReferences(text);
    expect(refs).toContain("workflow_runs");
    expect(refs).toContain("approval_requests");
    expect(refs).not.toContain("team_member");
    expect(refs).not.toContain("ai_workforce_dashboard");
    expect(refs).not.toContain("clerk_secret_key");
  });

  it("does not flag prose snake_case as unknown entities", () => {
    const text = `
      Super admins use the approval_centre screen.
      Column clerk_user_id references users.id.
    `;
    const issues = validateEntityReferencesInText(minimalBlueprint, text, "trd");
    expect(issues.filter((i) => i.category === "entity_registry")).toHaveLength(0);
  });

  it("flags unknown explicit table references", () => {
    const text = "CREATE TABLE mystery_table (id uuid);";
    const issues = validateEntityReferencesInText(minimalBlueprint, text, "backend_schema");
    expect(issues.some((i) => i.message.includes("mystery_table"))).toBe(true);
  });
});

describe("extractStates env filtering", () => {
  it("excludes environment variables and table constants", () => {
    const text = `
      Set OPENROUTER_API_KEY and DATABASE_URL in env.
      Table APPROVAL_REQUESTS stores rows.
      State PENDING_APPROVAL transitions to APPROVED.
    `;
    expect(isLikelyEnvironmentVariable("OPENROUTER_API_KEY")).toBe(true);
    expect(isLikelyEnvironmentVariable("DATABASE_URL")).toBe(true);

    const states = extractStates(text);
    expect(states).not.toContain("OPENROUTER_API_KEY");
    expect(states).not.toContain("DATABASE_URL");
    expect(states).not.toContain("APPROVAL_REQUESTS");
    expect(states).toContain("PENDING_APPROVAL");
  });

  it("filterWorkflowStates keeps workflow-like tokens", () => {
    expect(filterWorkflowStates(["WAITING_APPROVAL", "RUNNING", "FOO_BAR"])).toEqual([
      "WAITING_APPROVAL",
      "RUNNING",
    ]);
  });
});
