import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

await sql`
  ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "blueprint_model" jsonb
`;

await sql`
  ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "readiness_breakdown" jsonb
`;

console.log("Added projects.blueprint_model and projects.readiness_breakdown columns (or already present)");
