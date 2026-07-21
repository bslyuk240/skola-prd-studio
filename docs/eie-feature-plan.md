# Engineering Intelligence Engine (EIE) — Feature Plan

**Normalized reference document**  
**Source:** SkolaTech PRD Studio feature impact plan (21 July 2026)  
**Status:** Ready for implementation  
**Canonical naming:** See [eie-normalization.md](./eie-normalization.md)

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [Guiding Principle & Modules](#2-guiding-principle--modules)
3. [User Stories](#3-user-stories)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Database Schema](#6-database-schema)
7. [API Specification](#7-api-specification)
8. [UI Specification](#8-ui-specification)
9. [Integration Points](#9-integration-points)
10. [Security Requirements](#10-security-requirements)
11. [Acceptance Criteria](#11-acceptance-criteria)
12. [Risk Assessment](#12-risk-assessment)
13. [Testing Strategy](#13-testing-strategy)
14. [Deployment & Environment](#14-deployment--environment)
15. [Do Not Touch List](#15-do-not-touch-list)

---

## 1. Feature Overview

### What this feature does

The **Engineering Intelligence Engine (EIE)** is a modular internal knowledge platform and semantic engine. Platform Administrators ingest unstructured engineering materials (video files, YouTube/Vimeo links, PDFs, technical books, GitHub repositories, markdown files, research papers, personal notes). The system:

1. Detects source type automatically
2. Extracts textual information (transcription, OCR, parsing, repository analysis)
3. Identifies engineering **concepts** (not raw text)
4. Groups related concepts
5. Compares against authoritative sources where applicable
6. Produces AI-generated engineering synthesis with structured fields
7. Allows administrators to review, edit, merge, split, reject, or publish
8. Stores only approved knowledge in the **Engineering Knowledge Library**
9. Enriches PRD/TRD generation via retrieval-augmented context
10. Exposes a **Learning Hub** for end-user consumption

### Why it's needed

Standard LLM generation relies on generic training data, producing hallucinated boundaries, generic cloud recommendations, and code that doesn't match organizational standards. EIE establishes a curated context loop: admins feed actual architectural decisions, documentation versions, security standards, and reference implementations. The generator stays synchronized and contextual.

### Who benefits

| Role | Benefit |
|------|---------|
| **Platform Administrators** | Centralized ingestion pipeline for code reviews, architecture briefs, post-mortems, engineering standards |
| **End Users / Developers** | Navigable Learning Hub with implementation guidelines and patterns tied to PRD tasks |
| **AI Coding Agents (MCP)** | External tools query published knowledge via MCP tool `query_engineering_knowledge` |

### Success criteria

- **Vector search latency:** Context retrieval within **<350ms** during document generation
- **Extraction accuracy:** AI concept extraction reduces human categorization effort by **≥75%**
- **Downstream enhancement:** Generated PRDs reference curated concepts with traceable citation IDs

### System context

EIE operates within **Next.js 16.2.9**, **Drizzle ORM**, **PostgreSQL (Neon)**, and **Clerk** auth. It extends existing models without modifying core workspace CRUD.

```
       [Raw Knowledge Sources]
                  │
                  ▼
   ┌─────────────────────────────┐
   │  Knowledge Ingestion Desk   │  ◄── Admin-curated
   └──────────────┬──────────────┘
                  │
                  ▼
   ┌─────────────────────────────┐
   │   eie_synthesis_drafts      │  ◄── Admin review
   └──────────────┬──────────────┘
                  │
                  ▼
   ┌─────────────────────────────┐
   │  eie_published_knowledge    │  ───► Learning Hub
   └──────────────┬──────────────┘
                  │ (Semantic fetch)
                  ▼
   ┌─────────────────────────────┐
   │  PRD Intelligence Connector │
   └──────────────┬──────────────┘
                  │
                  ▼
   ┌─────────────────────────────┐
   │   OpenAI Generation Core    │  ───► Enriched PRDs / Blueprints
   └─────────────────────────────┘
```

---

## 2. Guiding Principle & Modules

**Admin curates → Users consume → PRD Engine benefits.**

EIE is an extensible internal knowledge platform that continuously improves Skola PRD Studio without replacing the existing AI reasoning engine.

| Module | Code path | Responsibility |
|--------|-----------|----------------|
| **Knowledge Ingestion Engine (KIE)** | `src/lib/eie/ingestion/` | Accept uploads/URLs, create source records, queue processing |
| **AI Transcription Engine (TPE)** | `src/lib/eie/parsers/` | Extract raw text from video, PDF, markdown, GitHub |
| **Concept Extraction Engine (CEE)** | `src/lib/eie/extraction/` | Isolate discrete engineering concepts from raw text |
| **Knowledge Synthesis Engine (KSE)** | `src/lib/eie/synthesis/` | Generate structured synthesis fields per concept |
| **Validation Engine (VE)** | Admin UI + `/api/admin/eie/drafts/*` | Review, edit, merge, split, approve/reject |
| **Knowledge Library** | `eie_published_knowledge` table | Approved, searchable concept store |
| **Learning Hub** | `/learning-hub` UI + `/api/eie/library` | User-facing browse/search |
| **PRD Intelligence Connector (PIC)** | `src/lib/eie/prd-connector.ts` | RAG injection into document generation |

---

## 3. User Stories

### Story 1: Material Ingestion (Admin)
*As a* Platform Administrator, *I want to* upload technical assets (Vimeo links, PDF guides, markdown templates) through a centralized wizard, *so that* the intelligence engine can digest custom internal standards.

### Story 2: Review & Edit (Admin)
*As a* Platform Administrator, *I want to* inspect AI-proposed concepts (security analysis, implementation blocks) before publication, *so that* I can refine, merge duplicates, and correct inaccuracies.

### Story 3: Selective Reject/Publish (Admin)
*As a* Platform Administrator, *I want to* transition concepts through `draft` → `needs_revision` → `approved` → published, *so that* only vetted strategies reach users and generation pipelines.

### Story 4: Browsing Curated Concepts (Developer)
*As a* Developer, *I want to* search and filter the Learning Hub by category and tags, *so that* I can implement approved architectures manually.

### Story 5: Automated Blueprint Enrichment (Developer)
*As a* Developer generating a `backend_schema` or `security_blueprint`, *I want* the system to reference organizational cryptographic and multi-tenant constraints, *so that* generated code is review-ready.

### Story 6: Concept Association & Lineage (Developer)
*As a* Developer reviewing an implementation plan, *I want* injected concepts to cite source documents (e.g., RFC references), *so that* I can audit recommendation origins.

### Story 7: Agentic Context Loading (MCP Agent)
*As an* external AI agent connected via MCP, *I want to* query the knowledge library for topics like "caching policies", *so that* local generation matches EIE patterns.

### Story 8: Concept Management & Splitting (Admin)
*As a* Platform Administrator, *I want to* split an overly general concept into two distinct cards, *so that* frameworks stay encapsulated around single concerns.

---

## 4. Functional Requirements

### 4.1 Knowledge Ingestion Engine (KIE)

| ID | Requirement |
|----|-------------|
| FR-1.1 | Support local file uploads: `.pdf` (up to 40MB), `.md` (up to 2MB), video (up to 50MB, max 2 hours) |
| FR-1.2 | Support external URLs: YouTube, Vimeo, TikTok (where supported), GitHub repos, official documentation URLs |
| FR-1.3 | Support direct markdown/text input via modal for personal notes |
| FR-1.4 | Create records in `eie_knowledge_sources` with trackable status (`pending` → `processing` → `success` / `failed`) |
| FR-1.5 | Store uploaded files in Cloudflare R2/S3 via signed URLs; record `file_key` on source record |

### 4.2 AI Transcription & Parsing Engine (TPE)

| ID | Requirement |
|----|-------------|
| FR-2.1 | Detect source type from input (URL pattern, file extension, MIME type) |
| FR-2.2 | Route audio/video to Whisper API (or equivalent) for transcription |
| FR-2.3 | Parse PDFs into structured text segments |
| FR-2.4 | Walk public GitHub repos via API, isolating source files from lockfiles/assets |
| FR-2.5 | Expose uniform interface: `extractText(source: EieKnowledgeSource): Promise<string>` |

### 4.3 Concept Extraction Engine (CEE)

| ID | Requirement |
|----|-------------|
| FR-3.1 | Process raw content via OpenAI structured output (`response_format: json_object`) |
| FR-3.2 | Isolate discrete engineering concepts (e.g., "OAuth Authorization Code Flow with PKCE") |
| FR-3.3 | Map concepts to existing taxonomy to minimize duplicates |
| FR-3.4 | Create one `eie_synthesis_drafts` row per extracted concept |

### 4.4 Knowledge Synthesis Engine (KSE)

Each concept draft must include these structured fields:

| Field | Type | Description |
|-------|------|-------------|
| `concept_name` | text | Canonical concept identifier |
| `summary` | text | Core engineering summary |
| `practical_explanation` | text | Functional deep-dive |
| `best_practices` | jsonb (string[]) | Bulleted best practices |
| `trade_offs` | jsonb | Array of `{ alternative, pro, con }` or string[] |
| `alternative_approaches` | jsonb (string[]) | When to skip this pattern |
| `security_considerations` | jsonb (string[]) | Risks, parameters, mitigations |
| `common_mistakes` | jsonb (string[]) | Anti-patterns |
| `implementation_recommendations` | jsonb | Stack suggestions, sample blueprints |
| `references` | jsonb | Array of `{ title, url }` |

### 4.5 Validation Engine (VE)

| ID | Requirement |
|----|-------------|
| FR-5.1 | Render drafts in admin grid by status |
| FR-5.2 | **Edit:** Read/write all synthesis JSON fields |
| FR-5.3 | **Merge:** Combine similar drafts into one |
| FR-5.4 | **Split:** Divide one draft into multiple |
| FR-5.5 | **Reject:** Set status to `rejected` |
| FR-5.6 | **Approve & Publish:** Materialize to `eie_published_knowledge`, generate embedding |

### 4.6 Knowledge Library

| ID | Requirement |
|----|-------------|
| FR-6.1 | Published concepts accessible to authenticated users only |
| FR-6.2 | Generate pgvector embedding (1536 dims, `text-embedding-3-small`) on publish |
| FR-6.3 | Full-text search index on concept name, category, summary |
| FR-6.4 | Track view count on published concepts |

### 4.7 Learning Hub

| ID | Requirement |
|----|-------------|
| FR-7.1 | Searchable index with category and tag filters |
| FR-7.2 | Concept detail view with all synthesis sections |
| FR-7.3 | Export published concepts as PDF or Markdown |

### 4.8 PRD Intelligence Connector (PIC)

| ID | Requirement |
|----|-------------|
| FR-8.1 | Hook into document generation before OpenAI completion |
| FR-8.2 | Vector similarity search against `eie_published_knowledge` |
| FR-8.3 | Retrieve top **3** most relevant concepts (max **1000 tokens** total context) |
| FR-8.4 | Inject as system prompt block: |
| | `=== MANDATORY SYSTEM ARCHITECTURE RULES ===` |
| | `Based on company approved engineering rules:` |
| | `- [Concept Name]: [Security Considerations] [Implementation Recommendations]` |
| | `==========================================` |
| FR-8.5 | Log retrievals in `eie_prd_retrievals` with relevance score |
| FR-8.6 | Backwards compatible: silent fallback if no matches or query fails |

### 4.9 MCP Integration

| ID | Requirement |
|----|-------------|
| FR-9.1 | Register MCP tool `query_engineering_knowledge` |
| FR-9.2 | Accept `searchQuery` (required) and `category` (optional) |
| FR-9.3 | Return published concepts only; strip admin metadata |

---

## 5. Non-Functional Requirements

### Performance
- **P-1:** Vector retrieval **<350ms** (target **<150ms** with HNSW index)
- **P-2:** Ingestion/processing runs asynchronously (QStash/Inngest/background function); API returns immediately with job ID
- **P-3:** Netlify API routes must not block >26s on parsing

### Accessibility & Design
- **A-1:** Follow SkolaTech design system (see CLAUDE.md / AGENTS.md)
- **A-2:** shadcn/ui components, lucide-react icons, responsive layouts
- **A-3:** Admin JSON editors with validation feedback

### Stability
- **S-1:** Integrate with Next.js 16.2.9 + Drizzle ORM without altering existing tables
- **S-2:** All EIE queries fail gracefully; never break core generation flow

---

## 6. Database Schema

All additions are **additive only**. No changes to existing `projects`, `documents`, or other core tables.

### 6.1 Enums

```typescript
export const eieSourceTypeEnum = pgEnum("eie_source_type", [
  "video_upload", "video_url", "pdf", "book", "official_doc",
  "github_repo", "markdown_file", "research_paper", "personal_note",
]);

export const eieSourceStatusEnum = pgEnum("eie_source_status", [
  "pending", "processing", "success", "failed",
]);

export const eieSynthesisStatusEnum = pgEnum("eie_synthesis_status", [
  "draft", "needs_revision", "approved", "rejected",
]);
```

### 6.2 Tables

#### `eie_knowledge_sources`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text NOT NULL | Human-readable title |
| source_type | eie_source_type NOT NULL | |
| source_url | text | Remote URL |
| file_key | text | R2/S3 object key |
| raw_content | text | Extracted transcript/OCR text |
| status | eie_source_status DEFAULT 'pending' | |
| error_message | text | Failure reason |
| metadata | jsonb DEFAULT '{}' | Duration, page count, repo branch, etc. |
| created_by | text NOT NULL | Clerk user ID |
| created_at / updated_at | timestamp | |

#### `eie_synthesis_drafts`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| source_id | uuid FK → eie_knowledge_sources | ON DELETE SET NULL |
| concept_name | text NOT NULL | |
| category | text NOT NULL | Standard category value |
| tags | text[] | e.g. `["security", "postgres"]` |
| summary | text NOT NULL | |
| practical_explanation | text NOT NULL | |
| best_practices | jsonb NOT NULL | string[] |
| trade_offs | jsonb NOT NULL | |
| alternative_approaches | jsonb NOT NULL | |
| security_considerations | jsonb NOT NULL | |
| common_mistakes | jsonb NOT NULL | |
| implementation_recommendations | jsonb NOT NULL | |
| references | jsonb NOT NULL | `{ title, url }[]` |
| status | eie_synthesis_status DEFAULT 'draft' | |
| reviewed_by | text | Clerk user ID |
| reviewed_at | timestamp | |
| created_at / updated_at | timestamp | |

#### `eie_published_knowledge`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| synthesis_draft_id | uuid FK → eie_synthesis_drafts | ON DELETE SET NULL |
| slug | text UNIQUE NOT NULL | URL-safe identifier |
| concept_name | text NOT NULL | |
| category | text NOT NULL | |
| tags | text[] | |
| summary | text NOT NULL | |
| practical_explanation | text NOT NULL | |
| best_practices | jsonb NOT NULL | |
| trade_offs | jsonb NOT NULL | |
| alternative_approaches | jsonb NOT NULL | |
| security_considerations | jsonb NOT NULL | |
| common_mistakes | jsonb NOT NULL | |
| implementation_recommendations | jsonb NOT NULL | |
| references | jsonb NOT NULL | |
| views_count | integer DEFAULT 0 | |
| embedding | vector(1536) | pgvector, populated on publish |
| created_at / updated_at | timestamp | |

#### `eie_concept_relationships`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| source_knowledge_id | uuid FK → eie_published_knowledge | ON DELETE CASCADE |
| target_knowledge_id | uuid FK → eie_published_knowledge | ON DELETE CASCADE |
| relationship_type | text DEFAULT 'related_to' | `extends`, `prerequisite`, etc. |
| created_at | timestamp | |
| UNIQUE(source_knowledge_id, target_knowledge_id, relationship_type) | | |

#### `eie_prd_retrievals`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| project_id | uuid FK → projects | ON DELETE CASCADE |
| document_id | uuid FK → documents | ON DELETE SET NULL (optional) |
| published_knowledge_id | uuid FK → eie_published_knowledge | ON DELETE CASCADE |
| relevance_score | numeric(4,3) NOT NULL | |
| retrieved_at | timestamp DEFAULT now() | |

### 6.3 Indexes

```sql
CREATE INDEX idx_eie_pub_slug ON eie_published_knowledge(slug);
CREATE INDEX idx_eie_pub_category ON eie_published_knowledge(category);
CREATE INDEX idx_eie_pub_search ON eie_published_knowledge
  USING gin(to_tsvector('english', concept_name || ' ' || category || ' ' || summary));
CREATE INDEX idx_eie_draft_status ON eie_synthesis_drafts(status);
CREATE INDEX idx_eie_source_status ON eie_knowledge_sources(status);
CREATE INDEX idx_eie_retrievals_proj ON eie_prd_retrievals(project_id);
CREATE INDEX idx_eie_pub_embedding ON eie_published_knowledge
  USING hnsw (embedding vector_cosine_ops);
```

### 6.4 Migration rules

- Expand-only: no ALTER on existing tables
- Zero-downtime deployment
- Rollback: DROP new tables and enums in reverse dependency order

---

## 7. API Specification

### 7.1 Response format

```json
{
  "success": true,
  "data": {},
  "pagination": { "currentPage": 1, "totalPages": 1, "totalCount": 0 }
}
```

Error format:
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human readable explanation",
  "details": []
}
```

### 7.2 Admin endpoints (`/api/admin/eie/*`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/admin/eie/sources` | Ingest URL or text source | Admin |
| POST | `/api/admin/eie/sources/upload` | Get signed upload URL / multipart upload | Admin |
| GET | `/api/admin/eie/sources` | List sources (paginated, filter by status/type) | Admin |
| GET | `/api/admin/eie/sources/[id]` | Source detail + processing status | Admin |
| POST | `/api/admin/eie/sources/[id]/process` | Trigger/retry extraction pipeline | Admin |
| DELETE | `/api/admin/eie/sources/[id]` | Purge source and raw content | Admin |
| GET | `/api/admin/eie/drafts` | List synthesis drafts (filter by status) | Admin |
| GET | `/api/admin/eie/drafts/[id]` | Draft detail with source raw content | Admin |
| PUT | `/api/admin/eie/drafts/[id]` | Full draft update | Admin |
| PATCH | `/api/admin/eie/drafts/[id]` | Partial draft update | Admin |
| POST | `/api/admin/eie/drafts/[id]/publish` | Approve draft → create published knowledge + embedding | Admin |
| POST | `/api/admin/eie/drafts/[id]/reject` | Set status rejected | Admin |
| POST | `/api/admin/eie/drafts/merge-split` | Merge multiple drafts or split one | Admin |

**Rate limits:** 10 ingestion requests/minute per admin.

### 7.3 Public endpoints (`/api/eie/*`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/eie/library` | Search/browse published concepts | Authenticated |
| GET | `/api/eie/library/[slug]` | Concept detail | Authenticated |
| GET | `/api/eie/library/[slug]/export` | Export PDF or Markdown | Authenticated |

Query params for library: `query`, `category`, `tags`, `page`, `limit`.

### 7.4 Modified existing endpoints

**POST `/api/generate`** and document generation routes:
- Before OpenAI call, invoke `src/lib/eie/prd-connector.ts`
- Log retrievals to `eie_prd_retrievals`
- Fully backwards compatible on failure

### 7.5 Error codes

| Code | HTTP | Trigger |
|------|------|---------|
| `UNSUPPORTED_INGESTION_SOURCE` | 400 | Invalid source type or URL |
| `EXTRACTION_JOB_FAILED` | 422 | Parser/transcription failure |
| `CONCEPT_NOT_PUBLISHED` | 403 | User requests unpublished draft |
| `RATE_LIMIT_EXCEEDED` | 429 | Admin exceeds ingestion limit |
| `MUTATION_VIOLATION` | 400 | Invalid merge/split payload |
| `SLUG_CONFLICT` | 409 | Duplicate slug on publish |

### 7.6 Auth pattern

```typescript
const { userId, sessionClaims } = await auth();
if (!userId) return 401;
const role = sessionClaims?.metadata?.role;
if (role !== "admin" && role !== "platform_admin") return 403;
```

Roles:
- **platform_admin:** Full control including global publish
- **admin:** Ingest, edit drafts; publish to tenant scope (future)
- **end user:** Read published library only

---

## 8. UI Specification

### 8.1 New screens

| Screen | Route | Access | Purpose |
|--------|-------|--------|---------|
| EIE Command Center | `/admin/eie` | Admin | Metrics, queue overview, quick actions |
| Source Ingestion Portal | `/admin/eie/ingest` | Admin | Upload files, enter URLs, trigger processing |
| Review Queue | `/admin/eie/review` | Admin | List pending drafts |
| Synthesis Audit | `/admin/eie/review/[id]` | Admin | Split-screen: raw source vs editable synthesis |
| Learning Hub | `/learning-hub` | Authenticated | Search, filter, browse concept cards |
| Concept Deep Dive | `/learning-hub/[slug]` | Authenticated | Full synthesis document view |

### 8.2 Modified existing screens

| Screen | Route | Change |
|--------|-------|--------|
| Document Viewer | `/projects/[projectId]/documents/[docId]` | Add EIE reference drawer showing injected concepts |
| Document Generation | Generation flow UI | Show "Querying EIE: [topic]..." status |
| Project Settings | `/projects/[projectId]/settings` | Toggle "Enable EIE Cross-Referencing" |
| Admin Dashboard | `/admin` (when exists) | Widgets: sources count, pending drafts, published count |

### 8.3 New components (`src/components/eie/`)

| Component | File | Purpose |
|-----------|------|---------|
| SourceIngestionForm | `source-ingestion-form.tsx` | Drag-drop upload, URL input, validation |
| SynthesisComparisonView | `synthesis-comparison-view.tsx` | Side-by-side raw vs synthesis editor |
| ConceptCard | `concept-card.tsx` | Learning Hub grid card |
| EIEEnrichmentPanel | `enrichment-panel.tsx` | Document viewer concept references |
| DraftReviewActions | `draft-review-actions.tsx` | Publish, reject, merge, split buttons |
| IngestionStatusBadge | `ingestion-status-badge.tsx` | Status badges for sources/drafts |

### 8.4 Navigation additions

**All users:** "Learning Hub" link in main nav  
**Admins only:** "Engineering Intelligence Engine" section with:
- Command Center (`/admin/eie`)
- Ingest Source (`/admin/eie/ingest`)
- Review Queue (`/admin/eie/review`) with pending count badge

### 8.5 UI states (all screens)

- **Loading:** Skeleton cards/rows; button shows `Loader2` spinner
- **Empty:** Descriptive copy (no motivational filler)
- **Error:** Alert banner or toast with actionable message

---

## 9. Integration Points

### 9.1 PRD Intelligence Connector

**File:** `src/lib/eie/prd-connector.ts`

**Hook location:** Document generation path (before OpenAI payload assembly)

**Logic:**
1. Parse project description, app type, platform, security level, stack preferences
2. Build search tags from project metadata
3. Query `eie_published_knowledge` (vector + keyword fallback)
4. Format top 3 matches into system prompt block (max 1000 tokens)
5. Insert retrievals into `eie_prd_retrievals`
6. On any error, return empty string (never throw)

### 9.2 MCP tool

**Tool name:** `query_engineering_knowledge`  
**Implementation:** Add handler in separate module `src/lib/eie/mcp-tool.ts`; register from MCP route with minimal inline change  
**Input:** `{ searchQuery: string, category?: string }`  
**Output:** Published concept summaries (stripped of admin fields)

### 9.3 Async processing

Ingestion pipeline steps (not in API request thread):
1. Extract text (TPE)
2. Extract concepts (CEE)
3. Synthesize drafts (KSE)
4. Update source status to `success` or `failed`

Trigger via QStash webhook → `/api/admin/eie/internal/process` (signed secret).

---

## 10. Security Requirements

### 10.1 Threat vectors & mitigations

| Threat | Mitigation |
|--------|------------|
| **SSRF via URL ingestion** | Block private IP ranges; DNS validation; dedicated fetch proxy |
| **RCE via malicious files** | File type/size limits; sandboxed parsing; no shell execution |
| **Prompt injection in sources** | Admin review gate; secondary validation LLM scan for override language |
| **IDOR on admin endpoints** | Strict Clerk role checks on all `/api/admin/eie/*` |
| **XSS in synthesis content** | Sanitize HTML on save; render as Markdown |
| **Data exfiltration** | Published-only for users; strip `file_key`, `created_by` from public API |

### 10.2 Upload limits

| Type | Max size | Allowed extensions |
|------|----------|-------------------|
| PDF | 40MB | `.pdf` |
| Markdown | 2MB | `.md`, `.txt` |
| Video | 50MB | `.mp4`, `.webm`, `.m4a` |

### 10.3 Export security

- Auth required on all exports
- Published-only for end users; admins can preview drafts
- Short-lived signed URLs (≤15 min) for raw asset downloads
- Audit log: actor_id, resource_id, format, timestamp

---

## 11. Acceptance Criteria

| ID | Feature | Validation |
|----|---------|------------|
| AC-1.1 | Ingestion | 20MB PDF creates `eie_knowledge_sources` row with status `pending` |
| AC-2.1 | Transcription | YouTube URL extracts readable transcript within 120s (async) |
| AC-3.2 | Concept extraction | API tutorial yields distinct concepts (JWT, Redis caching), not one blob |
| AC-4.1 | Synthesis structure | Output matches all required JSONB fields |
| AC-5.2 | Admin split | Split creates two draft rows from one |
| AC-6.2 | Publish embedding | Publish populates `embedding` vector field |
| AC-8.2 | PRD enrichment | Generation injects up to 3 concepts; logs in `eie_prd_retrievals` |
| AC-9.1 | Learning Hub | Published concepts searchable; drafts hidden |
| AC-10.1 | Admin RBAC | Non-admin gets 403 on `/api/admin/eie/*` |

---

## 12. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Generation latency spikes | Medium | High | Pre-fetch/cache; strict token limit |
| Hallucinated extractions | Medium | High | Mandatory admin review before publish |
| Vector index bottlenecks | Low | Medium | HNSW index; category pre-filter |
| Serverless timeout on ingestion | High | Medium | Async background workers |
| Prompt bloat | Medium | High | Max 1000 tokens EIE context |
| Schema migration conflicts | Low | High | Expand-only migrations |

---

## 13. Testing Strategy

### 13.1 Test framework setup
- **Vitest** + **MSW** for unit/integration (not yet in project)
- **Playwright** for E2E (not yet in project)

### 13.2 Unit tests

| Module | File | Scenarios |
|--------|------|-----------|
| Source detector | `src/lib/eie/detector.ts` | YouTube URL → `video_url`; GitHub → `github_repo`; PDF buffer → `pdf` |
| Zod schemas | `src/lib/zod/eie-schemas.ts` | Missing fields fail; valid payload maps to DB |
| Document parser | `src/lib/eie/parsers/document.ts` | PDF text extraction; markdown header hierarchy |
| PRD connector | `src/lib/eie/prd-connector.ts` | Mock concepts injected; empty fallback on error |

### 13.3 Integration tests

**Ingestion lifecycle:** PDF ingest → source `processing` → drafts created → source `success`  
**PRD enrichment:** Seed published concepts → generate document → verify injection + retrieval log

### 13.4 API tests

All endpoints: auth boundaries, Zod validation, pagination, 403 for non-admin.

### 13.5 E2E flows

1. Admin: ingest URL → review draft → edit → publish → verify in Learning Hub
2. User: search Learning Hub → open concept detail → verify all sections render

### 13.6 Security tests

IDOR, CSRF/unauthenticated requests, XSS in synthesis fields, SQL injection in search params.

### 13.7 Regression tests

- PRD generation still works with zero published concepts
- MCP route still functional after EIE tool addition
- Existing migrations unaffected

---

## 14. Deployment & Environment

### 14.1 Pre-deployment checklist

- [ ] Run `npm run db:generate` and review SQL (CREATE only, no DROP)
- [ ] Confirm no locks on `projects` / `documents` tables
- [ ] Async worker configured (QStash/Inngest)
- [ ] Clerk roles configured (`platform_admin`, `admin`)
- [ ] R2/S3 bucket created with CORS
- [ ] `npm run build` passes

### 14.2 Environment variables

| Variable | Purpose | Secret |
|----------|---------|--------|
| `EIE_STORAGE_BUCKET` | R2/S3 bucket name | No |
| `EIE_STORAGE_ENDPOINT` | R2 endpoint URL | No |
| `EIE_STORAGE_ACCESS_KEY` | Upload credentials | Yes |
| `EIE_STORAGE_SECRET_KEY` | Upload credentials | Yes |
| `EIE_EXTRACTION_MODEL` | OpenAI model for synthesis | No |
| `EIE_EMBEDDING_MODEL` | Embedding model name | No |
| `UPSTASH_QSTASH_TOKEN` | Async job queue | Yes |
| `EIE_INTERNAL_WEBHOOK_SECRET` | Sign internal process webhook | Yes |

### 14.3 Migration sequence

```bash
npm run db:generate
# Review drizzle/*.sql
npm run db:migrate
```

### 14.4 Rollback

1. Revert code deployment on Netlify
2. Drop EIE tables/enums (see normalization doc rollback SQL)
3. Remove env vars
4. Core PRD generation unaffected (connector fails silently)

---

## 15. Do Not Touch List

| File/Area | Reason |
|-----------|--------|
| Existing columns on `projects`, `project_inputs`, `documents` | Breaks historical records |
| `drizzle.config.ts` | Prevents migration config issues |
| Custom Clerk session parsing | Use standard `@clerk/nextjs/server` auth |
| Core MCP route logic structure | Extend via imported handler only |

---

## Appendix: Synthesis markdown template

When generating concept content, the KSE must produce sections equivalent to:

```markdown
## Engineering Summary
[Actionable synthesis]

## Practical Explanation
[Baseline setup / analogy]

## Best Practices
- [Bulleted criteria]

## Trade-offs
[Comparative considerations]

## Alternative Approaches
[When to skip this pattern]

## Security Considerations
[Risks and mitigations]

## Common Mistakes
[Anti-patterns]

## Implementation Recommendations
[Specific schema / architectural draft]
```

---

*This document supersedes all naming variants in the original PRD Studio export. Implementation follows [eie-build-plan.md](./eie-build-plan.md).*
