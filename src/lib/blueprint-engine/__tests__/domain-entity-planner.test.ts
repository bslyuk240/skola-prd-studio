import { describe, expect, it } from "vitest";
import { buildBlueprintSeedFromWizard } from "@/lib/blueprint-engine/extract/from-wizard-context";
import { finalizeBlueprint } from "@/lib/blueprint-engine/plan/finalize-blueprint";
import {
  inferSalesCrmDomain,
  mergeDomainEntities,
  planDomainEntities,
} from "@/lib/blueprint-engine/plan/domain-entity-planner";
import { applyEntityFieldTemplates } from "@/lib/blueprint-engine/plan/entity-field-templates";
import { validateSemanticConsistency } from "@/lib/blueprint-engine/validate/semantic-consistency-validator";
import type { ProjectContext } from "@/lib/ai-prompts";

const workforceContext: ProjectContext = {
  appName: "Skola Workforce",
  shortDescription:
    "AI-powered operations platform with sales, social media, and digital team members",
  mainFeatures: "Sales representative agent manages leads and follow-ups",
  multiTenancy: true,
};

describe("domain entity planner", () => {
  it("plans full CRM entity bundle for sales features", () => {
    expect(inferSalesCrmDomain(workforceContext)).toBe(true);
    const domain = planDomainEntities(workforceContext, {
      multiTenant: true,
      hasAiAgents: true,
      hasFileUpload: false,
      hasAsyncProcessing: true,
      hasRealtime: false,
    });
    expect(domain.contacts).toBeDefined();
    expect(domain.leads).toBeDefined();
    expect(domain.follow_ups).toBeDefined();
    expect(domain.interactions).toBeDefined();
    expect(domain.organization_memberships).toBeDefined();
    expect(domain.workflow_run_events).toBeDefined();
  });

  it("merges domain entities into finalized workforce blueprint", () => {
    const seed = buildBlueprintSeedFromWizard(workforceContext);
    const finalized = finalizeBlueprint(seed, workforceContext);

    expect(finalized.entities.contacts?.fields.length).toBeGreaterThan(0);
    expect(finalized.entities.leads?.fields.length).toBeGreaterThan(0);
    expect(finalized.entities.organization_memberships).toBeDefined();
    expect(finalized.entities.workflow_run_events).toBeDefined();
    expect(finalized.entities.approval_requests?.fields.some((f) => f.name === "payload_hash")).toBe(
      true
    );
    expect(finalized.entities.tool_executions?.fields.some((f) => f.name === "idempotency_key")).toBe(
      true
    );
    expect(finalized.policyEngine?.enabled).toBe(true);
  });

  it("does not overwrite existing entity definitions when merging", () => {
    const seed = buildBlueprintSeedFromWizard(workforceContext);
    seed.entities.leads = {
      ...seed.entities.leads!,
      description: "Custom leads table",
      fields: [{ name: "custom_field", type: "text" }],
      complete: true,
    };
    const merged = mergeDomainEntities(seed, workforceContext);
    expect(merged.entities.leads?.fields.some((f) => f.name === "custom_field")).toBe(true);
  });
});

describe("semantic consistency validator", () => {
  it("flags backend_schema that rejects domain tables while model defines CRM entities", () => {
    const seed = applyEntityFieldTemplates(finalizeBlueprint(buildBlueprintSeedFromWizard(workforceContext), workforceContext));
    const issues = validateSemanticConsistency(seed, [
      {
        type: "backend_schema",
        content:
          "Do not introduce custom CRM tables. Store lead data in tool_executions and workflow_runs metadata.",
      },
      {
        type: "prd",
        content: "Sales agent reads from contacts, leads, and follow_ups tables.",
      },
    ]);

    expect(issues.some((issue) => issue.id === "CONSISTENCY-SEM-ANTI-DOMAIN-TABLES")).toBe(true);
    expect(issues.some((issue) => issue.id === "CONSISTENCY-SEM-METADATA-DOMAIN")).toBe(true);
  });
});
