import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

await sql`
  ALTER TABLE "eie_knowledge_sources"
  ADD COLUMN IF NOT EXISTS "ai_credits_used" integer NOT NULL DEFAULT 0
`;

console.log("Added eie_knowledge_sources.ai_credits_used column (or already present)");
