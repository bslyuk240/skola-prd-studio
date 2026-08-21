import type { ProjectContext } from "@/lib/ai-prompts";

export type FeatureApiClassification = {
  featureKey: string;
  label: string;
  accessPattern: "read" | "write" | "read_write";
  delivery: "sync" | "async" | "webhook";
  requiresWebhook: boolean;
  suggestedEntity?: string;
};

function slugifyFeature(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

export function parseFeatureLines(ctx: Pick<ProjectContext, "mainFeatures" | "adminFeatures">): string[] {
  const raw = [ctx.mainFeatures, ctx.adminFeatures].filter(Boolean).join("\n");
  return [
    ...new Set(
      raw
        .split(/\n|(?<=[.;])\s+|[;,]|(?:^\s*[-*•]\s+)/m)
        .map((line) => line.replace(/^\d+[.)]\s*/, "").trim())
        .filter((line) => line.length > 2)
    ),
  ];
}

const ASYNC_PATTERN =
  /\b(agent|workflow|background|queue|job|async|schedule|trigger|batch|import|export|upload|report generation)\b/i;
const WEBHOOK_PATTERN = /\b(webhooks?|callback|stripe event|payment event)\b/i;
const READ_PATTERN =
  /\b(list|view|search|fetch|browse|read|dashboard|analytics|report|reports|export|download)\b/i;
const WRITE_PATTERN =
  /\b(create|update|delete|approve|reject|submit|upload|manage|assign|invite|pay|charge|send|notify)\b/i;

function inferEntity(label: string, entities: string[]): string | undefined {
  const slug = slugifyFeature(label);
  const direct = entities.find((e) => slug.includes(e) || e.includes(slug.replace(/s$/, "")));
  return direct;
}

/** Classify a feature line into API access and delivery needs. */
export function classifyFeatureApiNeed(
  label: string,
  entities: string[] = []
): FeatureApiClassification {
  const featureKey = slugifyFeature(label);
  const requiresWebhook = WEBHOOK_PATTERN.test(label);
  const delivery = requiresWebhook
    ? "webhook"
    : ASYNC_PATTERN.test(label)
      ? "async"
      : "sync";

  let accessPattern: FeatureApiClassification["accessPattern"] = "read_write";
  const isRead = READ_PATTERN.test(label);
  const isWrite = WRITE_PATTERN.test(label);
  if (isRead && !isWrite) accessPattern = "read";
  else if (isWrite && !isRead) accessPattern = "write";

  return {
    featureKey,
    label,
    accessPattern,
    delivery,
    requiresWebhook,
    suggestedEntity: inferEntity(label, entities),
  };
}

export function classifyFeaturesFromContext(
  ctx: Pick<ProjectContext, "mainFeatures" | "adminFeatures">,
  entities: string[] = []
): FeatureApiClassification[] {
  return parseFeatureLines(ctx).map((label) => classifyFeatureApiNeed(label, entities));
}
