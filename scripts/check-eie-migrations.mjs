import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const tables = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name LIKE 'eie_%'
  ORDER BY table_name
`;

const cols = await sql`
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (
      (table_name = 'eie_synthesis_drafts' AND column_name = 'metadata')
      OR (table_name = 'eie_knowledge_sources' AND column_name = 'ai_credits_used')
    )
  ORDER BY table_name, column_name
`;

const drizzleMigrations = await sql`
  SELECT id, hash, created_at
  FROM drizzle.__drizzle_migrations
  ORDER BY created_at
`.catch(() => null);

console.log("EIE tables:", tables.map((t) => t.table_name).join(", ") || "(none)");
console.log("Migration columns:");
for (const c of cols) {
  console.log(`  - ${c.table_name}.${c.column_name} (${c.data_type})`);
}
if (cols.length === 0) console.log("  (none found)");

if (drizzleMigrations) {
  console.log("Drizzle migrations applied:", drizzleMigrations.length);
  for (const m of drizzleMigrations) {
    console.log(`  - ${m.hash} @ ${m.created_at}`);
  }
} else {
  console.log("Drizzle migrations table: not present (likely used db:push instead of db:migrate)");
}
