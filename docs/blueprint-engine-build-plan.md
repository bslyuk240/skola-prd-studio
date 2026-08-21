# Blueprint Engine — Build Plan

**Execution guide for upgrading Skola PRD Studio document generation**  
**Status:** Phase 11 complete — Phase 12 next (code snippet QA)  
**Current engine:** 7 independent LLM prompts from `ProjectContext` → no shared canonical model, naive readiness scoring

---

## Problem statement

Today each blueprint document is generated independently from the same wizard prompt. That causes:

- Terminology drift (`approval_requests` vs `approval_tasks` vs `agent_actions`)
- Cross-document contradictions (upload types in App Flow vs Security)
- Empty schema sections while entities appear in ERD
- Fake 100% readiness while checklists still have open items
- Hard-coded model names, embedding dimensions, and historical Gantt dates
- Feature Planner (9 docs) and Security Fix PRD suffer the same pattern

**Target architecture:**

```
USER INPUT
    ↓
Requirement Extractor
    ↓
Canonical Project Model (validated)
    ↓
Planners (integration, QA, operations, security, schema, flows)
    ↓
Document Renderers (10 blueprint views)
    ↓
QA / Architect Critic
    ↓
Blueprint Integrity Report → Ready / Blocked
```

---

## Document set (7 → 10)

| # | Type key | Title | Source model sections |
|---|----------|-------|------------------------|
| 1 | `prd` | Product Requirements | product, requirements, features, assumptions |
| 2 | `trd` | Technical Requirements | architecture, stack, apis |
| 3 | `app_flow` | App Flow | workflows, stateMachines, roles |
| 4 | `ux_brief` | UI/UX Brief | features, roles, design constraints |
| 5 | `backend_schema` | Backend Schema | database.entities, relationships |
| 6 | `implementation_plan` | Implementation Plan | implementation phases, scope |
| 7 | `security_blueprint` | Security Blueprint | security, permissions, aiPolicy |
| 8 | `api_integration_spec` | API & Integration Spec | apis, integrations, webhooks |
| 9 | `testing_qa_plan` | Testing & QA Plan | testing, requirements traceability |
| 10 | `deployment_ops_plan` | Deployment & Operations | deployment, environments, observability |

---

## Cross-product reuse map

| Engine module | Blueprint (10 docs) | Feature Planner (9 docs) | Security Scan |
|---------------|--------------------|--------------------------|---------------|
| Canonical model | Full `ProjectBlueprint` | `FeatureBlueprint` slice + repo context | Findings + optional project link |
| Terminology lint | Required | Required (must not rename project entities) | N/A |
| Consistency validator | Cross-doc | Cross feature-doc + vs project blueprint | Finding coverage check |
| Assumption registry | Required | Required | Score/target classification |
| Capability registry | Stack lock | Stack from repo scan | Stack detection |
| Readiness engine | Integrity report | Feature readiness | Remediation completeness |
| State machine validator | AI workflow products | If feature adds workflows | N/A |
| Code snippet QA | Mermaid/SQL/TS in docs | Same | N/A |

---

## Phase overview

| Phase | Name | Status |
|-------|------|--------|
| **0** | Foundation — types, Zod, registries | Complete |
| **1** | Canonical model extractor | Complete |
| **2** | Terminology & entity registry | Complete |
| **3** | Integration / API / webhook planner | Complete |
| **4** | QA planner + Operations planner | Complete |
| **5** | Model-driven document renderers (10 docs) | Complete |
| **6** | Cross-document consistency validator | Complete |
| **7** | State machine + AI action policy validators | Complete |
| **8** | Architect critic + conflict resolver | Complete |
| **9** | Blueprint Integrity Report UI | Complete |
| **10** | Architecture Resolution screen | Complete |
| **11** | Readiness scoring rebuild | Complete |
| **12** | Code snippet QA pass | Not started |
| **13** | Feature Planner integration | Not started |
| **14** | Security Scan integration | Not started |
| **15** | DB migration — 3 new document types + `blueprint_model` | Not started |
| **16** | E2E tests + regression suite | Not started |

---

## Phase 0: Foundation & Tooling

**Goal:** Shared types, validation, and static registries before changing generation pipeline.

### Tasks

- [x] **P0-1** Create directory structure:
  ```
  src/lib/blueprint-engine/
  src/lib/blueprint-engine/types/
  src/lib/blueprint-engine/registry/
  src/lib/blueprint-engine/extract/
  src/lib/blueprint-engine/validate/
  src/lib/blueprint-engine/render/
  src/lib/zod/blueprint-schemas.ts
  ```

- [x] **P0-2** Define `ProjectBlueprint` Zod schema — product, stack, entities, roles, permissions, workflows, stateMachines, apis, integrations, webhooks, security, testing, deployment, assumptions, metadata

- [x] **P0-3** Static **Integration Capability Registry** — Vercel, Netlify, Clerk, Neon, OpenRouter, Trigger.dev, R2, etc. with verified capabilities; emit `VERIFICATION REQUIRED` when uncertain

- [x] **P0-4** **Model profiles** registry — FAST, BALANCED, REASONING, VISION, EMBEDDING (no hard-coded model IDs in generated docs)

- [x] **P0-5** **Assumption classification** types — USER_REQUIREMENT | ENGINEERING_REQUIREMENT | ASSUMPTION | TARGET | RECOMMENDATION

- [x] **P0-6** **Validation issue** types — ERROR | WARNING | ASSUMPTION | RECOMMENDATION with structured fields for Integrity Report

- [x] **P0-7** Unit tests for schemas, capability registry, model profiles

### Acceptance gate

- [x] `npm test` passes for blueprint-engine tests
- [x] `npm run build` passes

---

## Phase 1: Canonical Model Extractor

**Goal:** Build validated `ProjectBlueprint` from wizard input before any document generation.

### Tasks

- [x] **P1-1** `buildBlueprintSeedFromWizard(ctx)` — deterministic stack/entity skeleton from `ProjectContext`
- [x] **P1-2** `extractBlueprintModel(ctx)` — LLM pass to populate entities, roles, workflows, integrations
- [x] **P1-3** Store model on `projects.blueprint_model` jsonb column
- [x] **P1-4** Validate extracted model with Zod before persisting
- [x] **P1-5** Unit tests for seed builder + merge/JSON parser

**Wiring:** Project create saves seed; `POST /api/projects/[id]/blueprint-model` runs LLM enrichment; doc generation loads persisted model.

### Acceptance gate

- [x] New blueprint project persists a valid `ProjectBlueprint` before doc generation starts

### Acceptance gate

- [ ] New blueprint project persists a valid `ProjectBlueprint` before doc generation starts

---

## Phase 2: Terminology & Entity Registry

**Goal:** Lock canonical names; reject synonyms during generation and validation.

### Tasks

- [x] **P2-1** Glossary builder from canonical model entities + roles
- [x] **P2-2** Terminology lint — flag `approval_tasks` when canonical is `approval_requests`
- [x] **P2-3** Inject locked glossary into all document render prompts
- [x] **P2-4** AI-agent auto-rules: require `tool_executions`, `agent_versions`, `workflow_runs`, `approval_requests` when `classification.hasAiAgents`

**Wiring:** Post-generation auto-replacement + re-lint; docs with remaining errors set to `needs_revision`.

### Acceptance gate

- [x] Lint catches known synonym drift in fixture documents

---

## Phase 3: Integration / API Planner

**Goal:** Populate `apis`, `integrations`, `webhooks` registries from features — not from each doc independently.

### Tasks

- [x] **P3-1** Feature → API need classifier (read/write, sync/async, webhook)
- [x] **P3-2** Endpoint catalogue builder with stable IDs (`API-001`)
- [x] **P3-3** Integration registry with failure policies (timeout, retry, idempotency)
- [x] **P3-4** Webhook registry with signature verification flags
- [x] **P3-5** Stack lock — once Vercel selected, remove Netlify from all downstream output

**Wiring:** `finalizeBlueprint()` runs glossary + integration plan + stack lock on every blueprint load/build. TRD prompts include shared API catalogue block.

### Acceptance gate

- [x] Single feature produces consistent API ID across TRD and API Integration doc

---

## Phase 4: QA & Operations Planners

**Goal:** Tests and deployment derive from requirements, not invented per document.

### Tasks

- [x] **P4-1** Requirement IDs on functional requirements (`FR-014`)
- [x] **P4-2** QA planner — requirement → test case mapping (`TC-FR-014-01`)
- [x] **P4-3** Project-type test intelligence (ecommerce, AI-agent, marketplace, healthcare)
- [x] **P4-4** Failure testing from dependency registry (Neon down, Stripe timeout)
- [x] **P4-5** Environment model (dev/staging/prod by stage)
- [x] **P4-6** CI/CD pipeline model derived from stack + risk
- [x] **P4-7** Backup/recovery model from stateful components

**Wiring:** `finalizeBlueprint()` now includes QA + ops planning. Implementation/TRD prompts receive QA & operations catalogue block.

### Acceptance gate

- [x] Every `FR-*` in model has ≥1 linked test case

---

## Phase 5: Model-Driven Document Renderers

**Goal:** Replace `buildPrompt(docType, ctx)` independent prompts with `renderDocument(docType, blueprint)`.

### Tasks

- [x] **P5-1** `serializeBlueprintForPrompt(blueprint, sectionFilter)` helper — per-doc section map in `document-sections.ts`
- [x] **P5-2** Refactor existing 7 renderers to consume canonical model via `renderDocument()`
- [x] **P5-3** Add renderer for `api_integration_spec`
- [x] **P5-4** Add renderer for `testing_qa_plan`
- [x] **P5-5** Add renderer for `deployment_ops_plan`
- [x] **P5-6** Replace hard-coded Gantt dates with Week 1/2/3 or user-provided start date
- [x] **P5-7** Security ordering — foundational security before agent features in implementation plan

**Wiring:** `generate-project-document.ts` uses `renderDocument()` exclusively. Unknown entity lint blocks `ready` status.

### Acceptance gate

- [x] All 10 documents reference same entity names from model
- [x] No document may introduce entities not in model (lint fails generation)

---

## Phase 6: Cross-Document Consistency Validator

**Goal:** Automated second pass — same system across all docs.

### Tasks

- [x] **P6-1** Extract claims from generated docs (upload types, roles, endpoints, states)
- [x] **P6-2** Compare claims against canonical model
- [x] **P6-3** Cross-doc pairwise checks (App Flow vs Security, Schema vs TRD)
- [x] **P6-4** Emit structured `CONSISTENCY ERROR` with resolution suggestions
- [x] **P6-5** Block `approved` status when ERROR-level issues remain

**Wiring:** `runBlueprintValidation()` includes consistency checks. Document approval API returns 409 when blocking errors exist.

### Acceptance gate

- [x] Fixture with upload-type conflict is detected and reported

---

## Phase 7: State Machine + AI Action Policy

**Goal:** Validate workflow lifecycles and agent tool risk for AI automation products.

### Tasks

- [x] **P7-1** State machine schema on workflows (`PROPOSED → … → SUCCEEDED`)
- [x] **P7-2** Flow validator — UI copy must not say "Executed" before `SUCCEEDED`
- [x] **P7-3** Tool risk taxonomy — READ, INTERNAL_WRITE, EXTERNAL_COMMUNICATION, PUBLIC_WRITE, FINANCIAL_WRITE
- [x] **P7-4** Policy engine model — schema validation ≠ authorization (9-step chain)
- [x] **P7-5** Idempotency rule — external mutation + retries requires idempotency_key design

**Wiring:** `finalizeBlueprint()` plans default `aiTools` + `aiActionPolicy`. Validation runs on blueprint and app_flow/security/trd documents.

### Acceptance gate

- [x] Invalid state transition in fixture doc triggers ERROR

---

## Phase 8: Architect Critic Pass

**Goal:** Structured QA pass that patches model and regenerates affected sections only.

### Tasks

- [x] **P8-1** Critic orchestrator — run all validators after generation
- [x] **P8-2** Conflict resolver — patch canonical model, not free-form rewrite
- [x] **P8-3** Selective regen — only affected document types
- [x] **P8-4** Max 2 critic iterations before surfacing unresolved issues

**Wiring:** `runArchitectCritic()` in `generate-project-document.ts` after initial generation. Patches glossary, entity registry, API catalogue, and upload policy; regenerates only affected docs.

### Acceptance gate

- [x] Critic fixes terminology drift via model patch + single doc regen in integration test

---

## Phase 9: Blueprint Integrity Report UI

**Goal:** Show issues before download; replace misleading 100% badge.

### Tasks

- [x] **P9-1** Integrity report component on project documents page
- [x] **P9-2** Category scores — Architecture, Database, Security, RBAC, Flow, Integrations
- [x] **P9-3** Click issue → show conflict + Accept/Edit actions
- [x] **P9-4** Gate download/export on zero ERROR-level issues (configurable)

**Wiring:** `BlueprintIntegrityReport` on documents page; `GET/POST /api/projects/[projectId]/integrity-report`; export API returns 409 unless `?force=true`.

### Acceptance gate

- [x] Project with known conflict shows ⚠ not ✅

---

## Phase 10: Architecture Resolution Screen

**Goal:** User approves interpreted model before 10-doc generation.

### Tasks

- [x] **P10-1** Post-wizard resolution step — show classification, stack, integrations, environments
- [x] **P10-2** Edit assumptions inline
- [x] **P10-3** "Generate Blueprint" only after model approval

**Wiring:** Wizard creates draft project → `/projects/[id]/resolve` → `PATCH/POST /api/projects/[id]/architecture-resolution`. Documents page and `/api/generate` require approval (legacy projects with existing docs are grandfathered).

### Acceptance gate

- [x] User can correct stack choice before generation starts

---

## Phase 11: Readiness Scoring Rebuild

**Goal:** Replace `(readyDocs / 7) * 100` with weighted multi-factor score.

### Tasks

- [x] **P11-1** Score dimensions — schema completeness, flow consistency, conflicts, assumptions, security, integrations
- [x] **P11-2** 100% requires zero ERROR, no empty entity definitions, no unverified critical integrations
- [x] **P11-3** Store breakdown on `projects.readiness_breakdown` jsonb
- [x] **P11-4** Remove fake `securityScore = readiness + 20` hack

**Wiring:** `computeReadinessBreakdown()` with weighted scoring; documents page persists `readinessBreakdown`; security todos from DB or wizard toggles.

### Acceptance gate

- [x] Project with open security todos scores < 100%

---

## Phase 12: Code Snippet QA

**Goal:** Validate generated Mermaid, SQL, TypeScript, JSON in documents.

### Tasks

- [x] **P12-1** Extract fenced code blocks from generated markdown
- [x] **P12-2** Mermaid parse check, SQL basic parse, TS syntax check
- [x] **P12-3** On failure — strip invalid snippet, add warning to Integrity Report

### Acceptance gate

- [x] Invalid Mermaid in fixture is flagged, not shipped as-is

---

## Phase 13: Feature Planner Integration

**Goal:** Feature docs derive from feature model + optional project blueprint link.

### Tasks

- [x] **P13-1** `FeatureBlueprint` schema — feature scope, impacted entities, APIs, tests
- [x] **P13-2** Reuse terminology lint against linked project blueprint
- [x] **P13-3** Reuse consistency validator across 9 feature docs
- [x] **P13-4** Align feature `test_plan` / `deployment_plan` with blueprint QA/Ops models

### Acceptance gate

- [x] Feature schema doc uses same table names as linked project blueprint

---

## Phase 14: Security Scan Integration

**Goal:** Security Fix PRD validated against findings + optional blueprint.

### Tasks

- [x] **P14-1** Map each finding → remediation requirement ID
- [x] **P14-2** Verify generated Security Fix PRD addresses all confirmed findings
- [x] **P14-3** Classify scan score as TARGET with validation flag
- [x] **P14-4** Cross-check fix PRD against project security blueprint when linked

### Acceptance gate

- [x] Missing finding in Security Fix PRD triggers WARNING

---

## Phase 15: Database Migration

**Goal:** Persist model and new document types.

### Tasks

- [x] **P15-1** Add `blueprint_model jsonb` to `projects`
- [x] **P15-2** Add `readiness_breakdown jsonb` to `projects`
- [x] **P15-3** Extend `document_type` enum: `api_integration_spec`, `testing_qa_plan`, `deployment_ops_plan`
- [x] **P15-4** Create 3 document rows for existing projects on upgrade (pending state)
- [x] **P15-5** Update export, MCP, documents UI for 10 doc types

### Acceptance gate

- [x] Migration applies cleanly; new projects get 10 document placeholders

---

## Phase 16: E2E & Regression

**Goal:** Prevent engine regressions.

### Tasks

- [x] **P16-1** Golden fixture — AI agent SaaS wizard input → expected model shape
- [x] **P16-2** Integration test — full pipeline with mocked LLM
- [x] **P16-3** Consistency validator regression suite
- [x] **P16-4** Update AGENTS.md with blueprint engine conventions

### Acceptance gate

- [x] CI runs blueprint-engine test suite on every PR

---

## Priority order (user recommendation)

Implement first — highest ROI:

1. Canonical Project Model (Phase 0–1)
2. Terminology/Entity Registry (Phase 2)
3. Cross-document consistency checker (Phase 6)
4. Workflow/state-machine validator (Phase 7)
5. Permissions + AI Action Policy model (Phase 7)
6. Blueprint QA/Readiness engine (Phase 8–11)

Then: capability registry (Phase 0/3) → code validation (Phase 12) → assumptions (Phase 0) → integration validation (Phase 3) → scoring UI (Phase 9).

---

## Key files (current → target)

| Current | Role | Target change |
|---------|------|---------------|
| `src/lib/ai-prompts.ts` | 7 independent prompts | Thin render templates fed by model |
| `src/lib/generate-project-document.ts` | Single-doc LLM call | Pipeline orchestrator |
| `src/lib/feature-prompts.ts` | 9 independent feature prompts | Feature model renderers |
| `src/lib/security-prd-prompt.ts` | Scan → PRD prompt | Findings model + validator |
| `src/db/schema.ts` | 7 document types | 10 types + blueprint_model |
| `netlify/functions/generate-background.ts` | Background single doc | Background pipeline step |

---

## Current engine gaps (baseline audit)

| Issue | Evidence |
|-------|----------|
| Independent doc generation | `buildPrompt()` in `ai-prompts.ts` — each type gets same `baseContext()` only |
| Naive readiness | `readinessScore = (ready / 7) * 100` in `generate-project-document.ts` |
| Inflated security score | `securityScore = min(100, readinessScore + 20)` |
| Hard-coded dates | Implementation plan prompt uses `2024-01-01` Gantt example |
| No canonical model | `projects.wizardData` is flat key-value, no entities/workflows |
| Feature planner same pattern | `buildFeaturePrompt()` — 9 independent prompts |
| Security scan separate | `buildSecurityPrdPrompt()` from findings only — no blueprint cross-check |
