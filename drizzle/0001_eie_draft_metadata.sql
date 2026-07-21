ALTER TABLE "eie_synthesis_drafts" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}' NOT NULL;
