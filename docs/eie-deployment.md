# EIE Deployment Guide

Production release checklist for the Engineering Intelligence Engine.

## Pre-deploy checklist

- [ ] Run `node scripts/enable-pgvector.mjs` on Neon (once per database)
- [ ] Run `npm run db:generate` and review SQL (CREATE only, no DROP on existing tables)
- [ ] Run `npm run db:migrate` or `npm run db:push` on staging first
- [ ] Set all required env vars (see `.env.example`)
- [ ] Configure Clerk roles: `admin` or `platform_admin` in user `publicMetadata.role`
- [ ] Configure QStash + `EIE_INTERNAL_WEBHOOK_SECRET` for async ingestion
- [ ] Run `npm test`, `npm run build`, and `npm run lint`
- [ ] Complete manual QA checklist in `docs/eie-build-plan.md` Phase 12

## Migration sequence

```bash
# 1. Enable pgvector (Neon — run once)
node scripts/enable-pgvector.mjs

# 2. Generate and review migration
npm run db:generate
# Review drizzle/*.sql — EIE adds 5 tables + 3 enums

# 3. Apply to target database
npm run db:migrate
```

Existing migration snapshot: `drizzle/0000_lucky_fenris.sql` (full schema including EIE).

## Environment variables

Copy `.env.example` to `.env.local` for local development. Set the same keys in Netlify site settings for production.

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection |
| `CLERK_SECRET_KEY` | Yes | Auth |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Auth |
| `OPENROUTER_API_KEY` | Yes | Document + EIE synthesis generation |
| `UPSTASH_QSTASH_TOKEN` | Prod | Async ingestion queue |
| `EIE_INTERNAL_WEBHOOK_SECRET` | Prod | Webhook auth for process worker |
| `BACKGROUND_FUNCTION_SECRET` | Prod | HMAC auth for Netlify background generation |
| `URL` or `DEPLOY_PRIME_URL` | Prod | QStash callback + background jobs |
| `EIE_STORAGE_*` | No | File upload to R2/S3 |

## R2 / S3 bucket setup (manual)

Create a bucket for admin file uploads. Example Cloudflare R2 CORS config:

```json
[
  {
    "AllowedOrigins": ["https://your-app.netlify.app"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Set in Netlify:

```
EIE_STORAGE_BUCKET=your-bucket-name
EIE_STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
EIE_STORAGE_ACCESS_KEY=...
EIE_STORAGE_SECRET_KEY=...
```

Without storage configured, admins can still ingest personal notes, URLs, and GitHub repos.

## Rollback procedure

1. Revert the Netlify deployment to the previous release.
2. Run `docs/eie-rollback.sql` against the production database.
3. Remove EIE-specific env vars from Netlify.
4. Verify core PRD generation still works (EIE connector fails silently when tables are absent).

Rollback SQL drops only `eie_*` tables and enums. It does not modify `projects`, `documents`, or other core tables.

## Post-deploy smoke tests

1. Non-admin user cannot access `/admin/eie` (redirect to dashboard).
2. Admin can ingest a personal note and see it in Command Center.
3. Learning Hub loads published concepts.
4. Generate a PRD with EIE enabled — check `eie_prd_retrievals` rows.
5. MCP tool `query_engineering_knowledge` returns results for agent connections.
