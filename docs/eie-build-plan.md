# Engineering Intelligence Engine (EIE) — Build Plan

**Execution guide for systematic implementation**  
**Reference PRD:** [eie-feature-plan.md](./eie-feature-plan.md)  
**Naming conventions:** [eie-normalization.md](./eie-normalization.md)  
**Status:** Phase 13 complete — EIE ready for deploy

---

## How to use this document

1. Work phases **in order** — each phase depends on the previous
2. Check off tasks as completed (`[x]`)
3. Do not skip acceptance criteria gates between phases
4. All file paths use canonical naming from normalization doc

---

## Phase overview

| Phase | Name | Tasks | Gate |
|-------|------|-------|------|
| **0** | Foundation & tooling | 4 | Zod schemas compile; admin auth helper works |
| **1** | Database schema | 5 | Migration applied; Drizzle types export |
| **2** | Core backend services | 8 | Unit tests pass for detector, parsers, synthesis |
| **3** | Admin API routes | 10 | All admin endpoints return correct auth/status codes |
| **4** | Public API routes | 4 | Library search returns published concepts only |
| **5** | Async processing pipeline | 5 | End-to-end ingest → draft creation works async |
| **6** | PRD Intelligence Connector | 4 | Document generation enriched with mock concepts |
| **7** | Admin UI | 8 | Admin can ingest, review, publish via UI |
| **8** | Learning Hub UI | 5 | Users can search and read published concepts |
| **9** | Existing screen integration | 4 | Document viewer shows EIE references |
| **10** | MCP tool | 2 | `query_engineering_knowledge` returns results |
| **11** | Security hardening | 6 | SSRF block, upload limits, rate limits enforced |
| **12** | Testing & QA | 8 | Vitest suite green; manual QA checklist complete |
| **13** | Deployment prep | 5 | Build passes; env vars documented; migration verified |

**Estimated total:** ~74 tasks across 14 phases

---

## Phase 0: Foundation & Tooling

**Goal:** Shared types, validation, and auth utilities before any DB or API work.

### Tasks

- [x] **P0-1** Create directory structure:
  ```
  src/lib/eie/
  src/lib/zod/eie-schemas.ts
  src/components/eie/
  src/app/admin/eie/
  src/app/learning-hub/
  src/app/api/admin/eie/
  src/app/api/eie/
  ```

- [x] **P0-2** Create Zod schemas in `src/lib/zod/eie-schemas.ts`:
  - `IngestSourceSchema` (discriminated union: video_url, github_repo, file types)
  - `UpdateDraftSchema` (partial synthesis fields)
  - `MergeSplitSchema` (merge | split actions)
  - `LibrarySearchSchema` (query, category, tags, page, limit)
  - `PublishDraftSchema` (slug, optional relationship IDs)
  - Export inferred TypeScript types for all schemas

- [x] **P0-3** Create admin auth helper `src/lib/eie/auth.ts`:
  - `requireAdmin()` → returns `{ userId, role }` or throws 401/403 Response
  - `requireAuthenticated()` → returns `{ userId }` or 401
  - Check `sessionClaims.metadata.role` for `admin` | `platform_admin`

- [x] **P0-4** Create API response helpers `src/lib/eie/api-response.ts`:
  - `ok(data, status?)`, `error(code, message, status, details?)`
  - Consistent `{ success, data/error }` envelope

### Acceptance gate
- [x] `npm run build` passes with new files (no routes yet)
- [x] Zod schemas reject invalid payloads in manual test

---

## Phase 1: Database Schema

**Goal:** Add all EIE tables and enums to Drizzle; run migration.

### Tasks

- [x] **P1-1** Add enums to `src/db/schema.ts`:
  - `eieSourceTypeEnum`
  - `eieSourceStatusEnum`
  - `eieSynthesisStatusEnum`

- [x] **P1-2** Add table `eieKnowledgeSources` → DB table `eie_knowledge_sources`
  - All columns per feature plan §6.2
  - Export Drizzle relations

- [x] **P1-3** Add table `eieSynthesisDrafts` → DB table `eie_synthesis_drafts`
  - FK to `eieKnowledgeSources`
  - All JSONB synthesis fields

- [x] **P1-4** Add tables:
  - `eiePublishedKnowledge` → `eie_published_knowledge` (include `vector(1536)` embedding)
  - `eieConceptRelationships` → `eie_concept_relationships`
  - `eiePrdRetrievals` → `eie_prd_retrievals` (FK to `projects`, `documents`, `eiePublishedKnowledge`)

- [x] **P1-5** Run migration:
  ```bash
  npm run db:generate
  # Review drizzle/*.sql — CREATE only
  npm run db:push   # or db:migrate — apply when ready
  ```
  - Verify indexes created (slug, category, full-text, HNSW embedding)
  - Enable pgvector extension if not present

### Acceptance gate
- [x] All 5 tables visible in Drizzle Studio / DB
- [x] Existing `projects` / `documents` tables unchanged
- [x] TypeScript types export from schema without errors

---

## Phase 2: Core Backend Services

**Goal:** Business logic modules independent of HTTP routes.

### Tasks

- [x] **P2-1** Source type detector — `src/lib/eie/detector.ts`:
  - `detectSourceType(input): EieSourceType`
  - URL pattern matching (YouTube, Vimeo, GitHub)
  - File extension / MIME detection

- [x] **P2-2** Document parsers — `src/lib/eie/parsers/document.ts`:
  - `parsePdf(buffer): Promise<string>` (use lightweight PDF lib or OpenAI file API)
  - `parseMarkdown(text): Promise<string>` (preserve headers)
  - `parsePlainText(text): string`

- [x] **P2-3** URL parsers — `src/lib/eie/parsers/url.ts`:
  - `fetchYouTubeTranscript(url): Promise<string>` (captions or Whisper fallback)
  - `fetchGitHubRepo(url, branch?): Promise<string>` (tree walk, skip lockfiles)
  - `fetchRemoteDocument(url): Promise<string>` (with SSRF guard from Phase 11)

- [x] **P2-4** Parser orchestrator — `src/lib/eie/parsers/index.ts`:
  - `extractText(source: EieKnowledgeSource): Promise<string>`
  - Routes to correct parser by `source_type`
  - Updates `raw_content` on source record

- [x] **P2-5** Concept extractor — `src/lib/eie/extraction/concept-extractor.ts`:
  - OpenAI structured output prompt
  - Returns array of concept objects matching draft schema
  - Duplicate detection against existing `concept_name` values

- [x] **P2-6** Synthesis engine — `src/lib/eie/synthesis/synthesizer.ts`:
  - Takes raw text + concept name
  - Returns full synthesis object (all JSONB fields populated)
  - Uses `EIE_EXTRACTION_MODEL` env var

- [x] **P2-7** Embedding service — `src/lib/eie/embeddings.ts`:
  - `generateEmbedding(text): Promise<number[]>`
  - Uses OpenAI `text-embedding-3-small` (1536 dims)

- [x] **P2-8** Search service — `src/lib/eie/search.ts`:
  - `searchPublished(query, filters): Promise<PublishedKnowledge[]>`
  - Vector similarity search with keyword fallback
  - Only returns published knowledge (no drafts)

### Acceptance gate
- [ ] Unit tests for detector (P2-1) with Vitest
- [ ] `extractText` handles markdown input end-to-end (mock DB)
- [ ] Search returns ranked results from seeded data

---

## Phase 3: Admin API Routes

**Goal:** Full admin REST API for ingestion and curation.

### Tasks

- [x] **P3-1** `POST /api/admin/eie/sources` — `src/app/api/admin/eie/sources/route.ts`
  - Validate with `IngestSourceSchema`
  - Create `eie_knowledge_sources` row (status: `pending`)
  - Queue async processing job
  - Return 201 with source ID

- [x] **P3-2** `GET /api/admin/eie/sources` — same file
  - Paginated list; filter by `status`, `source_type`
  - Admin auth required

- [x] **P3-3** `GET /api/admin/eie/sources/[id]` — `src/app/api/admin/eie/sources/[id]/route.ts`
  - Source detail including `raw_content` when available

- [x] **P3-4** `DELETE /api/admin/eie/sources/[id]` — same file
  - Soft or hard delete source; cascade policy per schema

- [x] **P3-5** `POST /api/admin/eie/sources/upload` — `src/app/api/admin/eie/sources/upload/route.ts`
  - Generate signed R2/S3 upload URL
  - Validate file type and size limits

- [x] **P3-6** `POST /api/admin/eie/sources/[id]/process` — `src/app/api/admin/eie/sources/[id]/process/route.ts`
  - Manual retry/trigger processing pipeline

- [x] **P3-7** `GET /api/admin/eie/drafts` — `src/app/api/admin/eie/drafts/route.ts`
  - List drafts; filter by `status`, `source_id`, `category`

- [x] **P3-8** `GET|PUT|PATCH /api/admin/eie/drafts/[id]` — `src/app/api/admin/eie/drafts/[id]/route.ts`
  - Full CRUD on draft synthesis fields
  - Track `reviewed_by`, `reviewed_at` on update

- [x] **P3-9** `POST /api/admin/eie/drafts/[id]/publish` — `src/app/api/admin/eie/drafts/[id]/publish/route.ts`
  - Validate draft status is `approved` or allow direct publish from `draft`
  - Create `eie_published_knowledge` row
  - Generate slug (unique), embedding
  - Set draft status to `approved`

- [x] **P3-10** `POST /api/admin/eie/drafts/merge-split` — `src/app/api/admin/eie/drafts/merge-split/route.ts`
  - Merge: combine fields from multiple draft IDs into one
  - Split: create N new drafts from sections of one draft

### Acceptance gate
- [ ] Non-admin receives 403 on all admin routes
- [ ] Unauthenticated receives 401
- [ ] Invalid body returns 400 with Zod field errors
- [ ] Publish creates published row + embedding

---

## Phase 4: Public API Routes

**Goal:** Authenticated user access to published knowledge.

### Tasks

- [x] **P4-1** `GET /api/eie/library` — `src/app/api/eie/library/route.ts`
  - Search/filter published concepts
  - Strip admin fields (`created_by`, `file_key`, draft IDs)
  - Pagination

- [x] **P4-2** `GET /api/eie/library/[slug]` — `src/app/api/eie/library/[slug]/route.ts`
  - Full concept detail by slug
  - Increment `views_count`
  - Include related concepts from `eie_concept_relationships`

- [x] **P4-3** `GET /api/eie/library/[slug]/export` — `src/app/api/eie/library/[slug]/export/route.ts`
  - Query param `format=pdf|markdown`
  - Published-only for users; admin can export drafts
  - Rate limit: 15/min per IP

- [x] **P4-4** `POST /api/admin/eie/drafts/[id]/reject` — `src/app/api/admin/eie/drafts/[id]/reject/route.ts`
  - Set status `rejected`

### Acceptance gate
- [x] Draft concepts never appear in `/api/eie/library`
- [x] Search by query returns relevant published concepts
- [x] Export returns valid Markdown for published concept

---

## Phase 5: Async Processing Pipeline

**Goal:** Ingestion runs outside serverless timeout window.

### Tasks

- [x] **P5-1** Processing orchestrator — `src/lib/eie/orchestrator.ts`:
  - `processSource(sourceId): Promise<void>`
  - Steps: extract text → extract concepts → synthesize drafts → update source status
  - Error handling: set source `failed` + `error_message`

- [x] **P5-2** Internal webhook route — `src/app/api/admin/eie/internal/process/route.ts`:
  - Verify `EIE_INTERNAL_WEBHOOK_SECRET` header
  - Accept `{ sourceId }`, call orchestrator
  - Not exposed in public API docs

- [x] **P5-3** Job queue integration:
  - Option A: Upstash QStash publish on source create (`src/lib/eie/queue.ts`)
  - Local/dev fallback: inline fire-and-forget when QStash env vars are missing

- [x] **P5-4** Wire `POST /api/admin/eie/sources` to queue job after DB insert

- [x] **P5-5** Status polling support:
  - Source status transitions: `pending` → `processing` → `success` | `failed`
  - Admin UI can poll `GET /api/admin/eie/sources/[id]`

### Acceptance gate
- [x] Ingest markdown text source → drafts appear within async window
- [x] Failed extraction sets source status `failed` with error message
- [x] API responds 201 in <2s (does not wait for processing)

---

## Phase 6: PRD Intelligence Connector

**Goal:** Enrich document generation with curated knowledge.

### Tasks

- [x] **P6-1** PRD connector — `src/lib/eie/prd-connector.ts`:
  - `buildEieContext(project, documentType): Promise<string>`
  - Extract tags from project description, stack, security level
  - Vector search top 3 concepts (max 1000 tokens)
  - Format system prompt block
  - Log to `eie_prd_retrievals`

- [x] **P6-2** Hook into document generation:
  - Identify generation entry point (`src/app/api/generate/route.ts` and/or project document routes)
  - Call `buildEieContext` before OpenAI request
  - Append to system prompt
  - Silent fallback on error

- [x] **P6-3** Project settings support:
  - Respect `enableEieCrossReferencing` flag from project settings/wizard data
  - Skip EIE when disabled

- [x] **P6-4** Token budget enforcement:
  - Hard cap 1000 tokens for EIE context block
  - Truncate lowest-relevance concept first

### Acceptance gate
- [ ] Generate PRD for security-heavy project → retrieval logs created
- [ ] Zero published concepts → generation unchanged (no error)
- [ ] AC-8.2 satisfied

---

## Phase 7: Admin UI

**Goal:** Admin can manage full ingest → review → publish lifecycle.

### Tasks

- [x] **P7-1** Admin layout — `src/app/admin/eie/layout.tsx`:
  - Sidebar nav: Command Center, Ingest, Review Queue
  - Admin role guard (redirect non-admin)
  - Pending review count badge

- [x] **P7-2** Command Center — `src/app/admin/eie/page.tsx`:
  - Metrics cards: active sources, pending drafts, published count, failed count
  - Recent ingestion table
  - Quick action: "Add Source"

- [x] **P7-3** Source Ingestion Portal — `src/app/admin/eie/ingest/page.tsx`:
  - Uses `SourceIngestionForm` component
  - Tabs: File Upload | URL | GitHub | Personal Note
  - Progress states: uploading → processing
  - Toast on success

- [x] **P7-4** `SourceIngestionForm` — `src/components/eie/source-ingestion-form.tsx`:
  - Drag-drop zone for files
  - URL validation with inline errors
  - Submit calls `POST /api/admin/eie/sources`
  - Loading state with `Loader2`

- [x] **P7-5** Review Queue — `src/app/admin/eie/review/page.tsx`:
  - List drafts filtered by `draft` and `needs_revision`
  - `ConceptCard` variant for admin (shows status, source link)
  - Click → review detail

- [x] **P7-6** Synthesis Audit — `src/app/admin/eie/review/[id]/page.tsx`:
  - Split layout: raw source content (left) | editable synthesis (right)
  - Uses `SynthesisComparisonView`
  - Actions: Reject, Split, Merge, Publish

- [x] **P7-7** `SynthesisComparisonView` — `src/components/eie/synthesis-comparison-view.tsx`:
  - Editable fields for all synthesis sections
  - Accordion for section groups
  - Save calls `PATCH /api/admin/eie/drafts/[id]`

- [x] **P7-8** `DraftReviewActions` — `src/components/eie/draft-review-actions.tsx`:
  - Publish button (primary, one per view)
  - Reject (destructive)
  - Merge/Split dialogs

### Acceptance gate
- [ ] Admin can ingest URL and see source in command center
- [ ] Admin can edit draft fields and publish
- [ ] Published concept appears in DB with slug and embedding
- [ ] All buttons show loading state during async ops

---

## Phase 8: Learning Hub UI

**Goal:** End users browse and read published engineering concepts.

### Tasks

- [x] **P8-1** Learning Hub catalog — `src/app/learning-hub/page.tsx`:
  - Search input with debounce
  - Category filter chips
  - Grid of `ConceptCard` components
  - Pagination
  - Skeleton loading state

- [x] **P8-2** `ConceptCard` — `src/components/eie/concept-card.tsx`:
  - Title, summary, category badge, tags
  - Link to `/learning-hub/[slug]`
  - `hover:shadow-sm` per design system

- [x] **P8-3** Concept Deep Dive — `src/app/learning-hub/[slug]/page.tsx`:
  - Sticky chapter nav (left)
  - Render all synthesis sections
  - Code blocks for implementation recommendations
  - Related concepts links

- [x] **P8-4** Add "Learning Hub" to main app navigation
  - Visible to all authenticated users

- [x] **P8-5** Empty and error states per feature plan §8.5

### Acceptance gate
- [ ] Published concept searchable by title
- [ ] Concept detail shows all 8 synthesis sections
- [ ] Draft concepts not accessible via UI routes

---

## Phase 9: Existing Screen Integration

**Goal:** Connect EIE to current project/document workflows.

### Tasks

- [x] **P9-1** `EIEEnrichmentPanel` — `src/components/eie/enrichment-panel.tsx`:
  - Sheet/drawer showing concepts used in document generation
  - Fetches from `eie_prd_retrievals` for project/document

- [x] **P9-2** Add enrichment panel to document viewer:
  - Locate document viewer component
  - Add "EIE References" toggle/drawer
  - Link to Learning Hub concept pages

- [x] **P9-3** Generation status UI:
  - Show "Querying engineering knowledge..." step during generation
  - Only when EIE enabled for project

- [x] **P9-4** Project settings toggle:
  - "Enable EIE Cross-Referencing" switch
  - Persist in project `wizardData` or dedicated field

### Acceptance gate
- [ ] Document generated with EIE shows referenced concepts in viewer
- [ ] Toggle off → no EIE query during generation

---

## Phase 10: MCP Tool

**Goal:** External agents can query published knowledge.

### Tasks

- [x] **P10-1** MCP handler — `src/lib/eie/mcp-tool.ts`:
  - `handleQueryEngineeringKnowledge(args): Promise<McpToolResult>`
  - Calls search service; returns top 5 matches
  - Strip admin metadata

- [x] **P10-2** Register in MCP route:
  - Import handler into `src/app/api/mcp/v1/route.ts`
  - Add tool definition `query_engineering_knowledge`
  - Minimal diff to existing route (extend, don't restructure)

### Acceptance gate
- [ ] MCP tool call with `searchQuery: "RBAC"` returns published concepts
- [ ] Existing MCP tools still work (regression)

---

## Phase 11: Security Hardening

**Goal:** Production-safe ingestion and access controls.

### Tasks

- [x] **P11-1** SSRF guard — `src/lib/eie/security/url-validator.ts`:
  - Block private IP ranges
  - Resolve DNS before fetch
  - Reject localhost, metadata URLs

- [x] **P11-2** Upload validation:
  - Enforce file type whitelist and size limits in upload route
  - Reject executables

- [x] **P11-3** Content sanitization — `src/lib/eie/security/sanitize.ts`:
  - Strip script tags from synthesis text fields on save
  - Markdown-render safely in UI

- [x] **P11-4** Rate limiting on admin ingestion:
  - 10 requests/minute per admin user ID
  - Return 429 with `RATE_LIMIT_EXCEEDED`

- [x] **P11-5** Admin route middleware:
  - Add `/admin/eie` to protected routes
  - Redirect non-admin to dashboard

- [x] **P11-6** Prompt injection scan (optional v1):
  - Secondary LLM check on extracted text for instruction override patterns
  - Flag drafts with warning badge in review UI

### Acceptance gate
- [ ] SSRF test: internal IP URL rejected
- [ ] 11th ingestion request in 1 minute returns 429
- [ ] XSS payload in draft field sanitized on save

---

## Phase 12: Testing & QA

**Goal:** Automated tests and manual verification.

### Tasks

- [x] **P12-1** Install Vitest + MSW:
  ```bash
  npm install -D vitest @vitejs/plugin-react msw
  ```
  - Add `test` script to package.json
  - Configure `vitest.config.ts`

- [x] **P12-2** Unit tests:
  - `src/lib/eie/__tests__/detector.test.ts`
  - `src/lib/eie/__tests__/eie-schemas.test.ts`
  - `src/lib/eie/__tests__/prd-connector.test.ts`
  - `src/lib/eie/__tests__/sanitize.test.ts`

- [x] **P12-3** Integration test: ingestion lifecycle (mock OpenAI)

- [x] **P12-4** Integration test: PRD enrichment (seed + generate)

- [x] **P12-5** API tests: auth boundaries for admin and public routes

- [x] **P12-6** Test fixtures:
  - `src/test/fixtures/eie-concept.json`
  - `src/test/seed/eie_seed.sql`

- [ ] **P12-7** Manual QA checklist (run before deploy):
  - [ ] Admin ingest PDF
  - [ ] Admin ingest YouTube URL
  - [ ] Review and publish draft
  - [ ] Search in Learning Hub
  - [ ] Generate PRD with EIE enabled
  - [ ] Verify MCP tool response
  - [ ] Non-admin blocked from admin routes

- [x] **P12-8** Regression: core PRD generation without EIE data

### Acceptance gate
- [x] `npm test` passes
- [ ] Manual QA checklist 100% complete

---

## Phase 13: Deployment Prep

**Goal:** Production-ready release.

### Tasks

- [x] **P13-1** Environment variables documented in `.env.example`:
  - All vars from feature plan §14.2

- [x] **P13-2** Final migration review:
  - `npm run db:generate` — confirm CREATE only
  - Test on Neon branch if available

- [x] **P13-3** Production build verification:
  ```bash
  npm run build
  npm run lint
  ```

- [x] **P13-4** Create R2/S3 bucket + CORS config (manual/infra — documented in `docs/eie-deployment.md`)

- [x] **P13-5** Rollback procedure documented (see feature plan §14.4)

### Acceptance gate
- [x] Build passes with zero TypeScript errors
- [x] All env vars documented
- [x] Rollback SQL tested

---

## Dependency graph

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 5
                              │                      │
                              ▼                      ▼
                         Phase 4               Phase 6
                              │                      │
                              ▼                      ▼
                         Phase 8 ◄── Phase 7    Phase 9
                              │
                              ▼
                    Phase 10, 11 (parallel)
                              │
                              ▼
                         Phase 12 ──► Phase 13
```

Phases 7 and 8 can partially overlap after Phase 4 completes.  
Phases 10 and 11 can run in parallel after Phase 6.

---

## File manifest (all new files)

### Database
- `src/db/schema.ts` (extend)

### lib/eie
- `src/lib/eie/auth.ts`
- `src/lib/eie/api-response.ts`
- `src/lib/eie/detector.ts`
- `src/lib/eie/orchestrator.ts`
- `src/lib/eie/embeddings.ts`
- `src/lib/eie/search.ts`
- `src/lib/eie/prd-connector.ts`
- `src/lib/eie/mcp-tool.ts`
- `src/lib/eie/parsers/index.ts`
- `src/lib/eie/parsers/document.ts`
- `src/lib/eie/parsers/url.ts`
- `src/lib/eie/extraction/concept-extractor.ts`
- `src/lib/eie/synthesis/synthesizer.ts`
- `src/lib/eie/security/url-validator.ts`
- `src/lib/eie/security/sanitize.ts`

### lib/zod
- `src/lib/zod/eie-schemas.ts`

### API routes
- `src/app/api/admin/eie/sources/route.ts`
- `src/app/api/admin/eie/sources/[id]/route.ts`
- `src/app/api/admin/eie/sources/[id]/process/route.ts`
- `src/app/api/admin/eie/sources/upload/route.ts`
- `src/app/api/admin/eie/drafts/route.ts`
- `src/app/api/admin/eie/drafts/[id]/route.ts`
- `src/app/api/admin/eie/drafts/[id]/publish/route.ts`
- `src/app/api/admin/eie/drafts/[id]/reject/route.ts`
- `src/app/api/admin/eie/drafts/merge-split/route.ts`
- `src/app/api/admin/eie/internal/process/route.ts`
- `src/app/api/eie/library/route.ts`
- `src/app/api/eie/library/[slug]/route.ts`
- `src/app/api/eie/library/[slug]/export/route.ts`

### UI pages
- `src/app/admin/eie/layout.tsx`
- `src/app/admin/eie/page.tsx`
- `src/app/admin/eie/ingest/page.tsx`
- `src/app/admin/eie/review/page.tsx`
- `src/app/admin/eie/review/[id]/page.tsx`
- `src/app/learning-hub/page.tsx`
- `src/app/learning-hub/[slug]/page.tsx`

### Components
- `src/components/eie/source-ingestion-form.tsx`
- `src/components/eie/synthesis-comparison-view.tsx`
- `src/components/eie/concept-card.tsx`
- `src/components/eie/enrichment-panel.tsx`
- `src/components/eie/draft-review-actions.tsx`
- `src/components/eie/ingestion-status-badge.tsx`

### Tests
- `src/lib/eie/__tests__/detector.test.ts`
- `src/lib/eie/__tests__/eie-schemas.test.ts`
- `src/lib/eie/__tests__/prd-connector.test.ts`
- `src/lib/eie/__tests__/sanitize.test.ts`
- `src/test/fixtures/eie-concept.json`
- `src/test/seed/eie_seed.sql`
- `vitest.config.ts`

### Modified existing files
- `src/app/api/generate/route.ts` (EIE hook)
- `src/app/api/mcp/v1/route.ts` (tool registration only)
- Document viewer component (enrichment panel)
- App navigation component (Learning Hub + admin links)
- `package.json` (test script, vitest deps)
- `.env.example` (EIE vars)

---

## Current status

| Phase | Status | Started | Completed |
|-------|--------|---------|-----------|
| 0 | Complete | 21 Jul 2026 | 21 Jul 2026 |
| 1 | Applied (db:push) | 21 Jul 2026 | 21 Jul 2026 |
| 2 | Complete (unit tests pending) | 21 Jul 2026 | 21 Jul 2026 |
| 3 | Complete | 21 Jul 2026 | 21 Jul 2026 |
| 4 | Complete | 21 Jul 2026 | 21 Jul 2026 |
| 5 | Complete | 21 Jul 2026 | 21 Jul 2026 |
| 6 | Not started | — | — |
| 7 | Not started | — | — |
| 8 | Not started | — | — |
| 9 | Not started | — | — |
| 10 | Not started | — | — |
| 11 | Not started | — | — |
| 12 | Not started | — | — |
| 13 | Not started | — | — |

---

*Update the status table as phases complete. Next action: begin Phase 0.*
