import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

await sql`
  ALTER TABLE "security_scans"
  ADD COLUMN IF NOT EXISTS "project_id" uuid REFERENCES "projects"("id") ON DELETE SET NULL
`;

await sql`
  ALTER TABLE "security_scans"
  ADD COLUMN IF NOT EXISTS "security_scan_model" jsonb
`;

await sql`
  ALTER TABLE "security_scans"
  ADD COLUMN IF NOT EXISTS "validation_report" jsonb
`;

await sql`
  ALTER TABLE "security_findings"
  ADD COLUMN IF NOT EXISTS "remediation_requirement_id" text
`;

console.log("Added security scan blueprint columns (or already present)");
