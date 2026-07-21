-- EIE rollback script
-- Run only when reverting the Engineering Intelligence Engine deployment.
-- Core PRD Studio tables (projects, documents, etc.) are not affected.
-- Order respects foreign key dependencies.

BEGIN;

DROP TABLE IF EXISTS "eie_prd_retrievals" CASCADE;
DROP TABLE IF EXISTS "eie_concept_relationships" CASCADE;
DROP TABLE IF EXISTS "eie_published_knowledge" CASCADE;
DROP TABLE IF EXISTS "eie_synthesis_drafts" CASCADE;
DROP TABLE IF EXISTS "eie_knowledge_sources" CASCADE;

DROP TYPE IF EXISTS "eie_synthesis_status";
DROP TYPE IF EXISTS "eie_source_type";
DROP TYPE IF EXISTS "eie_source_status";

COMMIT;

-- Note: pgvector extension is intentionally left installed.
-- It may be shared with other features. Remove manually if unused:
--   DROP EXTENSION IF EXISTS vector;
