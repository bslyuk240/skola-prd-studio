import type { ProjectContext } from "@/lib/ai-prompts";
import type { ProjectBlueprint } from "@/lib/zod/blueprint-schemas";

function baseContext(ctx: ProjectContext): string {
  return `
App Name: ${ctx.appName}
Description: ${ctx.shortDescription}
Category: ${ctx.appCategory ?? "Not specified"}
Platform: ${ctx.platformType ?? "Web App"}
Security Level: ${ctx.securityLevel ?? "standard"}
`.trim();
}

export function renderApiIntegrationSpec(
  blueprint: ProjectBlueprint,
  ctx: ProjectContext
): string {
  return `You are an integration architect. Generate an API & Integration Specification derived from the canonical project model.

${baseContext(ctx)}

Required sections:
1. API catalogue overview — list every endpoint by stable ID (API-001, API-002, …)
2. Endpoint specifications — for each API ID: method, path, auth, idempotency, linked integration, request/response shape
3. Integration registry — for each INT-* entry: purpose, protocol, failure policy (timeout, retries, idempotency key)
4. Webhook catalogue — for each WH-* entry: provider, event, endpoint, signature verification steps
5. Retry and idempotency matrix (table: Integration | Timeout | Retries | Idempotency key required)
6. Error handling conventions for outbound integrations
7. Sequence diagrams (Mermaid) for the 2 highest-risk integrations

Rules:
- Do not invent endpoints or integrations not present in the canonical model
- Every endpoint must reference its API-* ID in headings
- Mark unverified integrations as VERIFICATION REQUIRED
`.trim();
}

export function renderTestingQaPlan(
  blueprint: ProjectBlueprint,
  ctx: ProjectContext
): string {
  return `You are a QA lead. Generate a Testing & QA Plan derived from the canonical requirements and test catalogue.

${baseContext(ctx)}

Required sections:
1. Test strategy overview (unit, integration, e2e, security, performance scope)
2. Requirement traceability matrix (table: FR-ID | Test case IDs | Type | Priority)
3. Test case catalogue — reproduce every TC-* ID from the model with steps and expected results
4. Failure scenario tests — cover every TC-FAIL-* integration outage case
5. AI-agent / domain-specific tests from TC-PROFILE-* entries (if present)
6. Entry/exit criteria per environment (${blueprint.deployment.environments.join(", ")})
7. CI gate alignment with deployment.ciPipeline stages

Rules:
- Every FR-* requirement must map to at least one test case ID from the model
- Do not invent requirements or test IDs outside the canonical catalogue
- Classify performance targets as TARGET unless user-provided
`.trim();
}

export function renderDeploymentOpsPlan(
  blueprint: ProjectBlueprint,
  ctx: ProjectContext
): string {
  return `You are a DevOps engineer. Generate a Deployment & Operations Plan from the canonical deployment model.

${baseContext(ctx)}

Required sections:
1. Environment model — describe each environment in deployment.environmentModel (purpose, data policy)
2. CI/CD pipeline — stages from deployment.ciPipeline in execution order
3. Release promotion flow (dev → staging → production${blueprint.deployment.environments.includes("disaster_recovery") ? " → disaster recovery" : ""})
4. Infrastructure overview aligned to stack: ${Object.entries(blueprint.stack)
    .filter(([key, value]) => key !== "locked" && value)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ")}
5. Backup & recovery runbook from deployment.backupRecovery (RPO/RTO per component)
6. Observability — logging, metrics, alerts for integrations and background jobs
7. Operational checklists (pre-deploy, post-deploy, rollback)

Rules:
- Hosting provider must match stack.hosting (${blueprint.stack.hosting ?? "from model"})
- Do not reference providers excluded by stack lock
- Use Week-based rollout labels unless projectStartDate is set
`.trim();
}
