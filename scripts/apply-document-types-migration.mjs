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

await sql`
  ALTER TYPE "document_type" ADD VALUE IF NOT EXISTS 'api_integration_spec'
`;
await sql`
  ALTER TYPE "document_type" ADD VALUE IF NOT EXISTS 'testing_qa_plan'
`;
await sql`
  ALTER TYPE "document_type" ADD VALUE IF NOT EXISTS 'deployment_ops_plan'
`;

console.log("Extended document_type enum (or values already present)");

const newDocuments = [
  { type: "api_integration_spec", title: "API & Integration Specification" },
  { type: "testing_qa_plan", title: "Testing & QA Plan" },
  { type: "deployment_ops_plan", title: "Deployment & Operations Plan" },
];

for (const doc of newDocuments) {
  const inserted = await sql`
    INSERT INTO "documents" ("project_id", "type", "title", "status")
    SELECT p."id", ${doc.type}, ${doc.title}, 'pending'
    FROM "projects" p
    WHERE NOT EXISTS (
      SELECT 1
      FROM "documents" d
      WHERE d."project_id" = p."id"
        AND d."type" = ${doc.type}
    )
    RETURNING "id"
  `;
  console.log(`Backfilled ${inserted.length} ${doc.type} document row(s)`);
}

console.log("Phase 15 document migration complete");
