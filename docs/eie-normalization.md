# EIE Naming Normalization Decisions

This document records the canonical naming choices applied when normalizing the original PRD Studio feature impact plan. **All implementation must follow these conventions.**

| Area | Rejected variants (from original PRD) | **Canonical choice** |
|------|----------------------------------------|----------------------|
| Feature name | AI Knowledge Engine & Curated Engineering Library | **Engineering Intelligence Engine (EIE)** |
| DB table prefix | `knowledge_*`, `engineering_concepts`, mixed | **`eie_*`** |
| Source table | `knowledge_sources`, `eie_sources` | **`eie_knowledge_sources`** |
| Draft table | `knowledge_concepts`, `eie_concepts`, `eie_synthesis_drafts` | **`eie_synthesis_drafts`** |
| Published table | `knowledge_concepts` (single-table model) | **`eie_published_knowledge`** (separate published layer) |
| Relations table | `eie_concept_relations`, `conceptual_relations`, `documents_to_concepts` | **`eie_concept_relationships`** + **`eie_prd_retrievals`** |
| Source type enum | `knowledge_source_type`, mixed values (`youtube_url`, `pdf_document`, `documentation`) | **`eie_source_type`** with unified values |
| Source status enum | `ingestion_status`, `source_processing_status`, `eie_ingestion_status` | **`eie_source_status`**: `pending`, `processing`, `success`, `failed` |
| Draft status enum | `concept_status`, `eie_concept_status`, `eie_synthesis_status` (mixed values) | **`eie_synthesis_status`**: `draft`, `needs_revision`, `approved`, `rejected` |
| Admin API prefix | `/api/admin/intelligence/*`, `/api/eie/sources` (no admin prefix) | **`/api/admin/eie/*`** |
| Public API prefix | `/api/learning-library/*`, `/api/eie/search` | **`/api/eie/library/*`** |
| Admin UI routes | `/admin/intelligence-engine`, `/admin/eie/ingestion` | **`/admin/eie/*`** |
| User UI routes | `/learning-library`, `/projects/[id]/learning-library` | **`/learning-hub/*`** |
| Lib directory | `@/lib/eie/parsers.ts`, `@/lib/validation/eie.ts` | **`src/lib/eie/`** + **`src/lib/zod/eie-schemas.ts`** |
| Components | `@/components/admin/*`, `@/components/learning-hub/*` | **`src/components/eie/*`** |
| MCP tool name | `search_curated_knowledge_library`, `query_engineering_knowledge` | **`query_engineering_knowledge`** |
| PRD connector file | `src/lib/openai/prd-connector.ts`, inline in route | **`src/lib/eie/prd-connector.ts`** |
| Category field | `concept_category` enum only | **Text `category`** with documented standard values (enum optional later) |
| URL param for concepts | `[conceptId]`, `[id]` | **`[slug]`** for public routes; **`[id]`** for admin draft routes |

## Canonical enum values

### `eie_source_type`
`video_upload` · `video_url` · `pdf` · `book` · `official_doc` · `github_repo` · `markdown_file` · `research_paper` · `personal_note`

### `eie_source_status`
`pending` · `processing` · `success` · `failed`

### `eie_synthesis_status`
`draft` · `needs_revision` · `approved` · `rejected`

### Standard category values (text field, not DB enum)
`architecture` · `security_compliance` · `database_persistence` · `scaling_performance` · `microservices_event_driven` · `frontend_ux_patterns` · `api_design` · `devops_deployment`

## Rollback SQL

To revert EIE without affecting core PRD Studio tables, run `docs/eie-rollback.sql`:

```sql
-- Drops eie_prd_retrievals → eie_knowledge_sources, then eie_* enums
-- Does NOT drop projects, documents, or pgvector extension
```

See `docs/eie-deployment.md` for the full rollback procedure.

## Design system override

The original UI plan specified purple/indigo accents. Per SkolaTech design system rules, EIE UI must use:
- `bg-primary` (forest green) for primary actions
- `text-emerald-600` for success/verified states
- `text-muted-foreground` for secondary text
- No purple gradients or `bg-indigo-*` on interactive elements
