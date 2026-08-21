export type ServiceCapability = {
  provider: string;
  capabilities: string[];
  integrationMethods: string[];
  supportsOAuth: boolean;
  supportsWebhooks: boolean;
  supportsBackgroundJobs: boolean;
  supportsDirectUpload: boolean;
  docsVerifiedAt: string | null;
};

export const SERVICE_CAPABILITY_REGISTRY: Record<string, ServiceCapability> = {
  vercel: {
    provider: "Vercel",
    capabilities: ["hosting", "preview_deployments", "serverless_functions", "edge"],
    integrationMethods: ["git_push", "cli"],
    supportsOAuth: false,
    supportsWebhooks: true,
    supportsBackgroundJobs: false,
    supportsDirectUpload: false,
    docsVerifiedAt: "2026-08-21",
  },
  netlify: {
    provider: "Netlify",
    capabilities: ["hosting", "preview_deployments", "serverless_functions", "background_functions"],
    integrationMethods: ["git_push", "cli"],
    supportsOAuth: false,
    supportsWebhooks: true,
    supportsBackgroundJobs: true,
    supportsDirectUpload: false,
    docsVerifiedAt: "2026-08-21",
  },
  clerk: {
    provider: "Clerk",
    capabilities: ["authentication", "user_management", "rbac_metadata", "webhooks"],
    integrationMethods: ["sdk", "api"],
    supportsOAuth: true,
    supportsWebhooks: true,
    supportsBackgroundJobs: false,
    supportsDirectUpload: false,
    docsVerifiedAt: "2026-08-21",
  },
  neon: {
    provider: "Neon PostgreSQL",
    capabilities: ["postgres", "branching", "connection_pooling"],
    integrationMethods: ["connection_string"],
    supportsOAuth: false,
    supportsWebhooks: false,
    supportsBackgroundJobs: false,
    supportsDirectUpload: false,
    docsVerifiedAt: "2026-08-21",
  },
  openrouter: {
    provider: "OpenRouter",
    capabilities: ["chat_completions", "embeddings", "speech_to_text"],
    integrationMethods: ["api"],
    supportsOAuth: false,
    supportsWebhooks: false,
    supportsBackgroundJobs: false,
    supportsDirectUpload: false,
    docsVerifiedAt: "2026-08-21",
  },
  trigger_dev: {
    provider: "Trigger.dev",
    capabilities: ["background_jobs", "retries", "scheduling", "workflow_runs"],
    integrationMethods: ["sdk", "webhooks"],
    supportsOAuth: false,
    supportsWebhooks: true,
    supportsBackgroundJobs: true,
    supportsDirectUpload: false,
    docsVerifiedAt: "2026-08-21",
  },
  cloudflare_r2: {
    provider: "Cloudflare R2",
    capabilities: ["object_storage", "presigned_uploads", "s3_compatible_api"],
    integrationMethods: ["s3_api"],
    supportsOAuth: false,
    supportsWebhooks: false,
    supportsBackgroundJobs: false,
    supportsDirectUpload: true,
    docsVerifiedAt: "2026-08-21",
  },
  drizzle: {
    provider: "Drizzle ORM",
    capabilities: ["schema_migrations", "type_safe_queries"],
    integrationMethods: ["npm_package"],
    supportsOAuth: false,
    supportsWebhooks: false,
    supportsBackgroundJobs: false,
    supportsDirectUpload: false,
    docsVerifiedAt: "2026-08-21",
  },
};

const STACK_ALIASES: Record<string, string> = {
  vercel: "vercel",
  netlify: "netlify",
  clerk: "clerk",
  neon: "neon",
  "neon postgresql": "neon",
  openrouter: "openrouter",
  "trigger.dev": "trigger_dev",
  triggerdev: "trigger_dev",
  "cloudflare r2": "cloudflare_r2",
  r2: "cloudflare_r2",
  drizzle: "drizzle",
  "netlify functions": "netlify",
};

export function resolveServiceKey(value: string | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (STACK_ALIASES[normalized]) return STACK_ALIASES[normalized];
  if (normalized.includes("netlify")) return "netlify";
  if (normalized.includes("vercel")) return "vercel";
  if (normalized.includes("neon")) return "neon";
  if (normalized.includes("clerk")) return "clerk";
  if (normalized.includes("openrouter")) return "openrouter";
  if (normalized.includes("trigger")) return "trigger_dev";
  if (normalized.includes("r2") || normalized.includes("cloudflare")) return "cloudflare_r2";
  if (normalized.includes("drizzle")) return "drizzle";
  return null;
}

export function getServiceCapability(value: string | undefined): ServiceCapability | null {
  const key = resolveServiceKey(value);
  if (!key) return null;
  return SERVICE_CAPABILITY_REGISTRY[key] ?? null;
}

/** Returns conflicting hosting providers when stack is locked to one. */
export function detectStackConflicts(stack: Record<string, string | boolean | undefined>): string[] {
  const hosting = stack.hosting;
  const hostingKey = typeof hosting === "string" ? resolveServiceKey(hosting) : null;
  if (!hostingKey) return [];

  const conflicts: string[] = [];
  for (const [field, value] of Object.entries(stack)) {
    if (field === "hosting" || field === "locked" || !value || typeof value !== "string") continue;
    const key = resolveServiceKey(value);
    if (key && key !== hostingKey && key === "netlify" && hostingKey === "vercel") {
      conflicts.push(`${field} references Netlify while hosting is Vercel`);
    }
    if (key && key !== hostingKey && key === "vercel" && hostingKey === "netlify") {
      conflicts.push(`${field} references Vercel while hosting is Netlify`);
    }
  }
  return conflicts;
}

export function requiresVerification(value: string | undefined): boolean {
  return getServiceCapability(value) === null && Boolean(value?.trim());
}
