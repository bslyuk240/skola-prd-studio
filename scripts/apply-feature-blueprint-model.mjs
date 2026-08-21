import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

await sql`
  ALTER TABLE "feature_requests"
  ADD COLUMN IF NOT EXISTS "project_id" uuid REFERENCES "projects"("id") ON DELETE SET NULL
`;

await sql`
  ALTER TABLE "feature_requests"
  ADD COLUMN IF NOT EXISTS "feature_blueprint_model" jsonb
`;

console.log("Added feature_requests.project_id and feature_requests.feature_blueprint_model columns (or already present)");
