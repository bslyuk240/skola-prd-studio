/** Extract only explicit SQL/schema table references — not prose or column names. */

const EXPLICIT_TABLE_PATTERNS: RegExp[] = [
  /`([a-z][a-z0-9_]+)`/gi,
  /CREATE TABLE (?:IF NOT EXISTS )?([a-z][a-z0-9_]+)/gi,
  /(?:FROM|JOIN|INTO|UPDATE)\s+([a-z][a-z0-9_]+)/gi,
  /REFERENCES\s+([a-z][a-z0-9_]+)/gi,
  /\b([a-z][a-z0-9_]+)\s+table\b/gi,
  /(?:entity|table):\s*([a-z][a-z0-9_]+)/gi,
];

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

export function extractExplicitTableReferences(text: string): string[] {
  const refs = new Set<string>();

  for (const pattern of EXPLICIT_TABLE_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const name = match[1].toLowerCase();
      if (name.length >= 3) refs.add(name);
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
