-- Add draft metadata for authoritative enrichment audit trail
ALTER TABLE "eie_synthesis_drafts"
ADD COLUMN IF NOT EXISTS "metadata" jsonb NOT NULL DEFAULT '{}';
