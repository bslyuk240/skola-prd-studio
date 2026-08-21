import { describe, expect, it } from "vitest";
import { buildBlueprintSeedFromWizard } from "@/lib/blueprint-engine/extract/from-wizard-context";
import { applyGlossaryToBlueprint } from "@/lib/blueprint-engine/registry/glossary-builder";
import { finalizeBlueprint } from "@/lib/blueprint-engine/plan/finalize-blueprint";
import {
  buildFeatureBlueprint,
  canonicalTableNames,
} from "@/lib/blueprint-engine/extract/build-feature-blueprint";
import { renderFeatureDocument } from "@/lib/blueprint-engine/render/render-feature-document";
import {
  serializeFeatureQaOpsForPrompt,
} from "@/lib/blueprint-engine/render/render-feature-document";
import { validateFeatureDocuments } from "@/lib/blueprint-engine/validate/feature-validation";
import type { ProjectContext } from "@/lib/ai-prompts";
import type { FeatureContext } from "@/lib/feature-prompts";
import type { ProjectBlueprint } from "@/lib/zod/blueprint-schemas";

const ctx: ProjectContext = {
  appName: "Skola Workforce",
  shortDescription: "Team management platform",
  mainFeatures: "Invite teammates",
  multiTenancy: true,
};

function linkedProjectBlueprint(): ProjectBlueprint {
  const seed = finalizeBlueprint(applyGlossaryToBlueprint(buildBlueprintSeedFromWizard(ctx)), ctx);
  return {
    ...seed,
    entities: {
      ...seed.entities,
      users: {
        id: "users",
        tableName: "users",
        description: "Application users",
        fields: [{ name: "id", type: "uuid", constraints: "PRIMARY KEY" }],
        complete: true,
      },
      organizations: {
        id: "organizations",
        tableName: "organizations",
        description: "Tenant organizations",
        fields: [{ name: "id", type: "uuid", constraints: "PRIMARY KEY" }],
        complete: true,
      },
    },
  };
}

const featureCtx: FeatureContext = {
  featureName: "Team Invites",
  featureDescription: "Allow admins to invite teammates to an organization",
  needsNewTables: true,
  affectsPermissions: true,
  scopeLevel: "mvp",
};

describe("feature blueprint integration", () => {
  it("builds feature model with linked entities and feature-scoped requirements", () => {
    const project = linkedProjectBlueprint();
    const featureBlueprint = buildFeatureBlueprint(
      {
        linkedProjectId: "00000000-0000-4000-8000-000000000001",
        name: "Team Invites",
        description: "Allow admins to invite teammates",
        needsNewTables: true,
        affectsPermissions: true,
        scopeLevel: "mvp",
      },
      project
    );

    expect(featureBlueprint.linkedEntities.users?.tableName).toBe("users");
    expect(featureBlueprint.linkedEntities.organizations?.tableName).toBe("organizations");
    expect(featureBlueprint.requirements.functional.some((req) => req.id.startsWith("FR-FEAT-"))).toBe(
      true
    );
    expect(featureBlueprint.testing.testCases.some((tc) => tc.id.startsWith("TC-FEAT-"))).toBe(true);
    expect(featureBlueprint.deltaApis.length).toBeGreaterThan(0);
  });

  it("acceptance gate: schema prompt requires canonical table names from linked blueprint", () => {
    const project = linkedProjectBlueprint();
    const featureBlueprint = buildFeatureBlueprint(
      {
        name: "Team Invites",
        description: "Invite flow",
        needsNewTables: true,
        scopeLevel: "mvp",
      },
      project
    );

    const prompt = renderFeatureDocument("schema_changes", featureCtx, featureBlueprint, project);
    const tables = canonicalTableNames(featureBlueprint, project);

    expect(tables).toContain("users");
    expect(tables).toContain("organizations");
    expect(prompt).toContain("`users`");
    expect(prompt).toContain("`organizations`");
    expect(prompt).toContain("CANONICAL ENTITY REGISTRY");
  });

  it("flags schema doc that uses wrong table alias vs linked blueprint", () => {
    const project = linkedProjectBlueprint();
    const featureBlueprint = buildFeatureBlueprint(
      {
        name: "Team Invites",
        description: "Invite flow",
        needsNewTables: true,
        scopeLevel: "mvp",
      },
      project
    );

    const issues = validateFeatureDocuments(featureBlueprint, project, [
      {
        type: "schema_changes",
        content: `
## Changes to Existing Tables
ALTER TABLE user_accounts ADD COLUMN invite_status text;
CREATE TABLE team_invites (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id)
);
        `,
      },
      {
        type: "api_changes",
        content: "POST /api/team-invites creates invite records in team_invites table.",
      },
    ]);

    expect(
      issues.some((issue) =>
        issue.message.includes('table "users"') || issue.message.includes("user_accounts")
      )
    ).toBe(true);
  });

  it("aligns test_plan and deployment_plan prompts with feature QA/Ops model", () => {
    const project = linkedProjectBlueprint();
    const featureBlueprint = buildFeatureBlueprint(
      {
        name: "Team Invites",
        description: "Invite flow",
        needsNewTables: true,
        scopeLevel: "mvp",
      },
      project
    );

    const testPrompt = serializeFeatureQaOpsForPrompt(featureBlueprint, project, "test_plan");
    const deployPrompt = serializeFeatureQaOpsForPrompt(featureBlueprint, project, "deployment_plan");

    expect(testPrompt).toContain("TC-FEAT-");
    expect(testPrompt).toContain("FR-FEAT-");
    expect(deployPrompt).toContain("rollback");
    expect(renderFeatureDocument("test_plan", featureCtx, featureBlueprint, project)).toContain(
      "TC-FEAT-"
    );
  });
});
