/** Extract only explicit SQL/schema table references — not columns, enums, or prose. */

const EXPLICIT_TABLE_PATTERNS: RegExp[] = [
  /CREATE TABLE (?:IF NOT EXISTS )?([a-z][a-z0-9_]+)/gi,
  /(?:FROM|JOIN|INTO|UPDATE)\s+([a-z][a-z0-9_]+)/gi,
  /REFERENCES\s+([a-z][a-z0-9_]+)/gi,
  /\b([a-z][a-z0-9_]+)\s+table\b/gi,
  /(?:entity|table):\s*([a-z][a-z0-9_]+)/gi,
];

const COLUMN_LIKE_SUFFIXES =
  /(_id|_at|_by|_type|_level|_status|_payload|_key|_name|_count|_url|_config|_number|_tag|_notes|_data|_params|_idx|_index|_hash|_token|_secret|_email|_role|_amount|_cost|_rate|_size|_mode|_flag)$/;

const ENUM_LIKE_TOKENS = new Set([
  "active",
  "approved",
  "pending",
  "draft",
  "failed",
  "cancelled",
  "canceled",
  "rejected",
  "queued",
  "running",
  "completed",
  "paused",
  "archived",
  "proposed",
  "executing",
  "waiting",
  "succeeded",
  "inactive",
  "enabled",
  "disabled",
  "deleted",
  "open",
  "closed",
  "status",
  "state",
  "type",
]);

const TABLE_LIKE_SUFFIXES = [
  "_requests",
  "_runs",
  "_executions",
  "_versions",
  "_logs",
  "_entries",
  "_records",
  "_items",
  "_events",
  "_tasks",
  "_documents",
  "_chunks",
  "_embeddings",
  "_connections",
  "_members",
  "_accounts",
  "_sessions",
  "_subscriptions",
  "_invoices",
  "_webhooks",
  "_notifications",
  "_messages",
  "_comments",
  "_attachments",
  "_files",
  "_assets",
  "_policies",
  "_roles",
  "_permissions",
  "_audits",
  "_metrics",
  "_snapshots",
  "_templates",
  "_profiles",
  "_settings",
];

const KNOWN_TABLE_NAMES = new Set([
  "users",
  "agents",
  "organizations",
  "documents",
  "workflows",
  "integrations",
  "subscriptions",
  "invoices",
  "sessions",
  "accounts",
  "members",
  "teams",
  "projects",
  "events",
  "logs",
  "files",
  "assets",
]);

const WORKFLOW_STATE_HINTS = new Set([
  "proposed",
  "pending",
  "approved",
  "queued",
  "executing",
  "succeeded",
  "rejected",
  "cancelled",
  "failed",
  "retry",
  "waiting",
  "running",
  "completed",
  "draft",
  "active",
  "paused",
  "archived",
  "awaiting",
  "human",
  "review",
]);

const ENV_VAR_SUFFIXES =
  /(_KEY|_URL|_DSN|_SECRET|_TOKEN|_HOST|_BUCKET|_NAME|_ID|_API|_UUID|_INDEX|_IDX)$/;

export function isLikelyColumnOrEnum(name: string): boolean {
  if (ENUM_LIKE_TOKENS.has(name)) return true;
  if (COLUMN_LIKE_SUFFIXES.test(name)) return true;
  return false;
}

/** Heuristic: does this snake_case token plausibly name a database table? */
export function looksLikeTableReference(name: string): boolean {
  if (isLikelyColumnOrEnum(name)) return false;
  if (KNOWN_TABLE_NAMES.has(name)) return true;
  if (TABLE_LIKE_SUFFIXES.some((suffix) => name.endsWith(suffix))) return true;
  if (/^[a-z][a-z0-9_]*s$/.test(name) && name.length >= 5) return true;
  return false;
}

export function extractExplicitTableReferences(text: string): string[] {
  const refs = new Set<string>();

  for (const pattern of EXPLICIT_TABLE_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const name = match[1].toLowerCase();
      if (name.length >= 3 && looksLikeTableReference(name)) {
        refs.add(name);
      }
    }
  }

  return [...refs].sort();
}

export function isLikelyEnvironmentVariable(token: string): boolean {
  if (!/^[A-Z][A-Z0-9_]+$/.test(token)) return false;
  if (token.startsWith("NEXT_PUBLIC_")) return true;
  if (ENV_VAR_SUFFIXES.test(token) && token.length >= 10) return true;
  if (token.includes("_API_") || token.endsWith("_XXXX")) return true;
  return false;
}

export function isLikelyTableConstant(token: string): boolean {
  const lower = token.toLowerCase();
  return (
    lower.endsWith("_requests") ||
    lower.endsWith("_runs") ||
    lower.endsWith("_executions") ||
    lower.endsWith("_versions") ||
    lower.endsWith("_agents") ||
    lower === "organizations" ||
    lower === "users"
  );
}

export function isLikelyWorkflowState(token: string): boolean {
  if (!/^[A-Z][A-Z0-9_]+$/.test(token)) return false;
  if (isLikelyEnvironmentVariable(token)) return false;
  if (isLikelyTableConstant(token)) return false;

  const parts = token.toLowerCase().split("_");
  return parts.some((part) => WORKFLOW_STATE_HINTS.has(part));
}

export function filterWorkflowStates(states: string[]): string[] {
  return states.filter(isLikelyWorkflowState);
}
