import type { ProjectBlueprint } from "@/lib/zod/blueprint-schemas";
import type { z } from "zod";
import type { testCaseSchema } from "@/lib/zod/blueprint-schemas";
import { resolveServiceKey } from "@/lib/blueprint-engine/registry/capabilities";

type TestCase = z.infer<typeof testCaseSchema>;

export type ProjectTypeProfile = "ai_agent" | "ecommerce" | "marketplace" | "healthcare" | "general";

export function inferProjectTypeProfile(blueprint: ProjectBlueprint): ProjectTypeProfile {
  const haystack = [
    blueprint.product.type,
    blueprint.classification.projectType,
    blueprint.product.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (blueprint.classification.hasAiAgents || /\b(agent|workflow|automation)\b/i.test(haystack)) {
    return "ai_agent";
  }
  if (/\b(ecommerce|e-commerce|shop|store|checkout|cart)\b/i.test(haystack)) {
    return "ecommerce";
  }
  if (/\b(marketplace|vendor|multi-vendor|two-sided)\b/i.test(haystack)) {
    return "marketplace";
  }
  if (/\b(healthcare|hipaa|clinical|patient|medical)\b/i.test(haystack)) {
    return "healthcare";
  }
  return "general";
}

const PROJECT_TYPE_TESTS: Record<
  Exclude<ProjectTypeProfile, "general">,
  Omit<TestCase, "id">[]
> = {
  ai_agent: [
    {
      requirementId: undefined,
      type: "integration",
      priority: "critical",
      description: "Agent cannot execute EXTERNAL_WRITE tools without approval_requests record",
      automationCandidate: true,
    },
    {
      requirementId: undefined,
      type: "security",
      priority: "critical",
      description: "tool_executions rows are append-only and tied to workflow_runs",
      automationCandidate: true,
    },
  ],
  ecommerce: [
    {
      requirementId: undefined,
      type: "integration",
      priority: "critical",
      description: "Checkout handles payment provider timeout with user-safe retry messaging",
      automationCandidate: true,
      failureScenario: "Payment provider timeout",
    },
    {
      requirementId: undefined,
      type: "e2e",
      priority: "high",
      description: "Order totals remain consistent across cart, checkout, and confirmation",
      automationCandidate: true,
    },
  ],
  marketplace: [
    {
      requirementId: undefined,
      type: "integration",
      priority: "critical",
      description: "Vendor-scoped data never leaks across seller tenants",
      automationCandidate: true,
    },
    {
      requirementId: undefined,
      type: "e2e",
      priority: "high",
      description: "Split payout flow completes when buyer payment webhook arrives",
      automationCandidate: true,
    },
  ],
  healthcare: [
    {
      requirementId: undefined,
      type: "security",
      priority: "critical",
      description: "PHI access is logged with actor, resource, and purpose",
      automationCandidate: true,
    },
    {
      requirementId: undefined,
      type: "accessibility",
      priority: "high",
      description: "Patient-facing flows meet WCAG 2.1 AA keyboard and contrast requirements",
      automationCandidate: false,
    },
  ],
};

function inferTestType(
  requirement: ProjectBlueprint["requirements"]["functional"][number],
  blueprint: ProjectBlueprint
): TestCase["type"] {
  const statement = requirement.statement.toLowerCase();
  if (/security|auth|tenant|isolation|approval|audit|encrypt/i.test(statement)) {
    return "security";
  }
  if (/upload|webhook|payment|integration|api|stripe|clerk/i.test(statement)) {
    return "integration";
  }
  if (/performance|latency|load|scale/i.test(statement)) {
    return "performance";
  }
  if (blueprint.apis.some((api) => statement.includes(api.path.replace("/api/", "")))) {
    return "integration";
  }
  return "e2e";
}

function priorityForRequirement(
  requirement: ProjectBlueprint["requirements"]["functional"][number]
): TestCase["priority"] {
  if (requirement.priority === "must_have") return "critical";
  if (requirement.priority === "should_have") return "high";
  return "medium";
}

function testCasesForRequirement(
  requirement: ProjectBlueprint["requirements"]["functional"][number],
  blueprint: ProjectBlueprint,
  startIndex: number
): TestCase[] {
  const cases: TestCase[] = [
    {
      id: `TC-${requirement.id}-01`,
      requirementId: requirement.id,
      type: inferTestType(requirement, blueprint),
      priority: priorityForRequirement(requirement),
      description: `Verify requirement ${requirement.id}: ${requirement.statement}`,
      automationCandidate: true,
    },
  ];

  if (requirement.scope === "required_now" && requirement.priority === "must_have") {
    cases.push({
      id: `TC-${requirement.id}-02`,
      requirementId: requirement.id,
      type: "unit",
      priority: "high",
      description: `Unit-test core logic for ${requirement.id} with edge cases and validation errors`,
      automationCandidate: true,
    });
  }

  return cases;
}

function failureTestsFromIntegrations(blueprint: ProjectBlueprint): TestCase[] {
  const tests: TestCase[] = [];

  for (const integration of blueprint.integrations) {
    const key = resolveServiceKey(integration.name);
    const timeout = integration.failurePolicy?.timeoutMs ?? 30000;
    tests.push({
      id: `TC-FAIL-${integration.id}-01`,
      requirementId: undefined,
      type: "integration",
      priority: key === "neon" || /stripe|payment/i.test(integration.name) ? "critical" : "high",
      description: `${integration.name} outage or ${timeout}ms timeout returns controlled degradation`,
      automationCandidate: true,
      failureScenario: `${integration.name} unavailable`,
      integrationId: integration.id,
    });

    if (integration.failurePolicy?.idempotencyKeyRequired) {
      tests.push({
        id: `TC-FAIL-${integration.id}-02`,
        requirementId: undefined,
        type: "integration",
        priority: "high",
        description: `Retrying ${integration.name} requests with the same idempotency key does not duplicate side effects`,
        automationCandidate: true,
        failureScenario: `${integration.name} duplicate retry`,
        integrationId: integration.id,
      });
    }
  }

  return tests;
}

function mergeTestCases(existing: TestCase[], planned: TestCase[]): TestCase[] {
  const byId = new Map<string, TestCase>();
  for (const testCase of existing) {
    byId.set(testCase.id, testCase);
  }
  for (const testCase of planned) {
    if (!byId.has(testCase.id)) {
      byId.set(testCase.id, testCase);
    }
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** Build requirement-linked and project-type test catalogue. */
export function planQaTestCases(blueprint: ProjectBlueprint): ProjectBlueprint["testing"] {
  const planned: TestCase[] = [];

  for (const requirement of blueprint.requirements.functional) {
    planned.push(...testCasesForRequirement(requirement, blueprint, planned.length));
  }

  const profile = inferProjectTypeProfile(blueprint);
  if (profile !== "general") {
    PROJECT_TYPE_TESTS[profile].forEach((testCase, index) => {
      planned.push({
        ...testCase,
        id: `TC-PROFILE-${profile.toUpperCase()}-${String(index + 1).padStart(2, "0")}`,
      });
    });
  }

  planned.push(...failureTestsFromIntegrations(blueprint));

  return {
    testCases: mergeTestCases(blueprint.testing.testCases, planned),
  };
}

export function everyRequirementHasTestCase(blueprint: ProjectBlueprint): boolean {
  if (blueprint.requirements.functional.length === 0) return true;
  const linked = new Set(
    blueprint.testing.testCases
      .map((testCase) => testCase.requirementId)
      .filter(Boolean) as string[]
  );
  return blueprint.requirements.functional.every((req) => linked.has(req.id));
}

export function requirementsMissingTests(blueprint: ProjectBlueprint): string[] {
  const linked = new Set(
    blueprint.testing.testCases
      .map((testCase) => testCase.requirementId)
      .filter(Boolean) as string[]
  );
  return blueprint.requirements.functional
    .filter((req) => !linked.has(req.id))
    .map((req) => req.id);
}
