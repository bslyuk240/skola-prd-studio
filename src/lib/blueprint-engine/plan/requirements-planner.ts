import type { ProjectContext } from "@/lib/ai-prompts";
import type { ProjectBlueprint } from "@/lib/zod/blueprint-schemas";
import { parseFeatureLines } from "@/lib/blueprint-engine/plan/feature-api-classifier";

type FunctionalRequirement = ProjectBlueprint["requirements"]["functional"][number];

function nextFrId(index: number): string {
  return `FR-${String(index + 1).padStart(3, "0")}`;
}

function normalizeStatement(statement: string): string {
  return statement.trim().toLowerCase();
}

function statementsMatch(a: string, b: string): boolean {
  const left = normalizeStatement(a);
  const right = normalizeStatement(b);
  return left === right || left.includes(right) || right.includes(left);
}

function structuralRequirements(blueprint: ProjectBlueprint): FunctionalRequirement[] {
  const requirements: FunctionalRequirement[] = [];

  if (blueprint.classification.multiTenant) {
    requirements.push({
      id: "",
      statement: "Every data query enforces tenant isolation by organization_id",
      priority: "must_have",
      scope: "required_now",
    });
  }

  if (blueprint.classification.hasFileUpload) {
    requirements.push({
      id: "",
      statement: "File uploads use presigned URLs with type and size validation",
      priority: "must_have",
      scope: "required_now",
    });
  }

  if (blueprint.classification.hasAiAgents) {
    requirements.push({
      id: "",
      statement: "High-risk agent tool calls require human approval before execution",
      priority: "must_have",
      scope: "required_now",
    });
    requirements.push({
      id: "",
      statement: "Every tool execution is recorded in tool_executions for audit",
      priority: "must_have",
      scope: "required_now",
    });
  }

  return requirements;
}

function assignRequirementIds(requirements: FunctionalRequirement[]): FunctionalRequirement[] {
  const result: FunctionalRequirement[] = [];
  const used = new Set<string>();
  let counter = 1;

  for (const req of requirements) {
    if (req.id && /^FR-\d{3}$/.test(req.id) && !used.has(req.id)) {
      used.add(req.id);
      result.push(req);
      counter = Math.max(counter, Number.parseInt(req.id.slice(3), 10) + 1);
      continue;
    }

    while (used.has(nextFrId(counter - 1))) counter += 1;
    const id = nextFrId(counter - 1);
    counter += 1;
    used.add(id);
    result.push({ ...req, id });
  }

  return result;
}

/** Assign stable FR-* IDs from wizard features and structural rules. */
export function planFunctionalRequirements(
  blueprint: ProjectBlueprint,
  ctx?: Pick<ProjectContext, "mainFeatures" | "adminFeatures">
): ProjectBlueprint["requirements"] {
  const featureLines = ctx ? parseFeatureLines(ctx) : [];
  const existing = blueprint.requirements.functional;
  const merged: FunctionalRequirement[] = [];

  for (const statement of featureLines) {
    const match = existing.find((req) => statementsMatch(req.statement, statement));
    if (match) {
      merged.push(match);
    } else {
      merged.push({
        id: "",
        statement,
        priority: "must_have",
        scope: "required_now",
      });
    }
  }

  for (const req of existing) {
    if (!merged.some((item) => item.id === req.id || statementsMatch(item.statement, req.statement))) {
      merged.push(req);
    }
  }

  for (const structural of structuralRequirements(blueprint)) {
    if (!merged.some((item) => statementsMatch(item.statement, structural.statement))) {
      merged.push(structural);
    }
  }

  const functional = assignRequirementIds(merged);

  const nonFunctional = [
    ...new Set([
      ...blueprint.requirements.nonFunctional,
      ...(blueprint.product.securityRequirement !== "standard"
        ? [`Security posture: ${blueprint.product.securityRequirement}`]
        : []),
      ...(blueprint.classification.hasAsyncProcessing
        ? ["Background jobs must be idempotent and retry-safe"]
        : []),
    ]),
  ];

  return { functional, nonFunctional };
}

export { nextFrId, statementsMatch };
