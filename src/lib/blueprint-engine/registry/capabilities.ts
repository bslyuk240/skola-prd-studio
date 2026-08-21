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
  stripe: {
    provider: "Stripe",
    capabilities: ["payments", "subscriptions", "invoices", "webhooks"],
    integrationMethods: ["sdk", "api", "webhooks"],
    supportsOAuth: false,
    supportsWebhooks: true,
    supportsBackgroundJobs: false,
    supportsDirectUpload: false,
    docsVerifiedAt: "2026-08-21",
  },
  sentry: {
    provider: "Sentry",
    capabilities: ["error_monitoring", "performance_tracing", "release_health"],
    integrationMethods: ["sdk", "api"],
    supportsOAuth: false,
    supportsWebhooks: true,
    supportsBackgroundJobs: false,
    supportsDirectUpload: false,
    docsVerifiedAt: "2026-08-21",
  },
  langfuse: {
    provider: "Langfuse",
    capabilities: ["llm_tracing", "prompt_management", "evaluations"],
    integrationMethods: ["sdk", "api"],
    supportsOAuth: false,
    supportsWebhooks: true,
    supportsBackgroundJobs: false,
    supportsDirectUpload: false,
    docsVerifiedAt: "2026-08-21",
  },
  gmail: {
    provider: "Gmail",
    capabilities: ["read_email", "send_email", "create_draft"],
    integrationMethods: ["oauth", "api"],
    supportsOAuth: true,
    supportsWebhooks: true,
    supportsBackgroundJobs: false,
    supportsDirectUpload: false,
    docsVerifiedAt: "2026-08-21",
  },
  whatsapp_business: {
    provider: "WhatsApp Business API",
    capabilities: ["send_message", "receive_message", "templates", "webhooks"],
    integrationMethods: ["api", "webhooks"],
    supportsOAuth: false,
    supportsWebhooks: true,
    supportsBackgroundJobs: false,
    supportsDirectUpload: false,
    docsVerifiedAt: "2026-08-21",
  },
  meta_instagram: {
    provider: "Meta / Instagram API",
    capabilities: ["publish_content", "read_insights", "webhooks"],
    integrationMethods: ["oauth", "api", "webhooks"],
    supportsOAuth: true,
    supportsWebhooks: true,
    supportsBackgroundJobs: false,
    supportsDirectUpload: true,
    docsVerifiedAt: "2026-08-21",
  },
  tiktok: {
    provider: "TikTok API",
    capabilities: ["publish_video", "read_analytics", "oauth_login"],
    integrationMethods: ["oauth", "api"],
    supportsOAuth: true,
    supportsWebhooks: true,
    supportsBackgroundJobs: false,
    supportsDirectUpload: true,
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
  stripe: "stripe",
  sentry: "sentry",
  langfuse: "langfuse",
  gmail: "gmail",
  "google gmail": "gmail",
  "whatsapp business": "whatsapp_business",
  "whatsapp business api": "whatsapp_business",
  whatsapp: "whatsapp_business",
  "meta instagram": "meta_instagram",
  "meta/instagram": "meta_instagram",
  instagram: "meta_instagram",
  "meta instagram api": "meta_instagram",
  tiktok: "tiktok",
  "tiktok api": "tiktok",
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
  if (normalized.includes("stripe")) return "stripe";
  if (normalized.includes("sentry")) return "sentry";
  if (normalized.includes("langfuse")) return "langfuse";
  if (normalized.includes("gmail")) return "gmail";
  if (normalized.includes("whatsapp")) return "whatsapp_business";
  if (normalized.includes("instagram") || normalized.includes("meta")) return "meta_instagram";
  if (normalized.includes("tiktok")) return "tiktok";
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

const EMPTY_INTEGRATION_VALUES = new Set([
  "none",
  "n/a",
  "na",
  "not selected",
  "not applicable",
  "no integration",
  "no payment",
  "no storage",
  "-",
  "null",
]);

/** Optional wizard fields that were left unset — never create integration records. */
export function isEmptyIntegrationValue(value: string | undefined): boolean {
  if (!value?.trim()) return true;
  return EMPTY_INTEGRATION_VALUES.has(value.trim().toLowerCase());
}

export function splitIntegrationValues(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter((part) => part && !isEmptyIntegrationValue(part));
}

export type IntegrationClassification = {
  verified: boolean;
  category: string;
  verificationStatus: "verified" | "project_defined" | "unverified";
};

/** Known registry providers are verified; everything else is a project-defined custom integration. */
export function classifyIntegration(name: string): IntegrationClassification {
  if (isEmptyIntegrationValue(name)) {
    return { verified: true, category: "service", verificationStatus: "verified" };
  }

  if (getServiceCapability(name)) {
    const key = resolveServiceKey(name);
    const capability = key ? SERVICE_CAPABILITY_REGISTRY[key] : null;
    const category =
      capability?.capabilities.includes("authentication")
        ? "auth"
        : capability?.capabilities.includes("postgres")
          ? "database"
          : capability?.capabilities.includes("hosting")
            ? "hosting"
            : capability?.capabilities.includes("payments")
              ? "payment"
              : "service";

    return { verified: true, category, verificationStatus: "verified" };
  }

  return {
    verified: true,
    category: "custom",
    verificationStatus: "project_defined",
  };
}

export function requiresVerification(value: string | undefined): boolean {
  if (isEmptyIntegrationValue(value)) return false;
  return classifyIntegration(value!).verificationStatus === "unverified";
}
