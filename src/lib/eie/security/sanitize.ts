const SCRIPT_TAG_PATTERN = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const EVENT_HANDLER_PATTERN = /\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JAVASCRIPT_URI_PATTERN = /javascript:/gi;

const INJECTION_PATTERNS = [
  /ignore (all )?(previous|prior|above) instructions/i,
  /disregard (your|the) (system|initial) prompt/i,
  /you are now (a|an) /i,
  /act as (a|an) (unrestricted|jailbroken)/i,
  /<\s*script/i,
  /javascript:/i,
];

export function sanitizeText(input: string): string {
  return input
    .replace(SCRIPT_TAG_PATTERN, "")
    .replace(EVENT_HANDLER_PATTERN, "")
    .replace(JAVASCRIPT_URI_PATTERN, "")
    .trim();
}

export function sanitizeStringArray(values: unknown): unknown {
  if (!Array.isArray(values)) return values;
  return values.map((value) =>
    typeof value === "string" ? sanitizeText(value) : value
  );
}

export function sanitizeDraftUpdate(
  data: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = { ...data };

  for (const key of [
    "conceptName",
    "summary",
    "practicalExplanation",
  ] as const) {
    if (typeof sanitized[key] === "string") {
      sanitized[key] = sanitizeText(sanitized[key] as string);
    }
  }

  for (const key of [
    "bestPractices",
    "alternativeApproaches",
    "securityConsiderations",
    "commonMistakes",
  ] as const) {
    if (key in sanitized) {
      sanitized[key] = sanitizeStringArray(sanitized[key]);
    }
  }

  if ("tradeOffs" in sanitized) {
    const tradeOffs = sanitized.tradeOffs;
    if (Array.isArray(tradeOffs)) {
      sanitized.tradeOffs = tradeOffs.map((item) => {
        if (typeof item === "string") return sanitizeText(item);
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          return {
            ...record,
            alternative:
              typeof record.alternative === "string"
                ? sanitizeText(record.alternative)
                : record.alternative,
            pro:
              typeof record.pro === "string" ? sanitizeText(record.pro) : record.pro,
            con:
              typeof record.con === "string" ? sanitizeText(record.con) : record.con,
          };
        }
        return item;
      });
    }
  }

  if ("implementationRecommendations" in sanitized) {
    const value = sanitized.implementationRecommendations;
    if (Array.isArray(value)) {
      sanitized.implementationRecommendations = sanitizeStringArray(value);
    } else if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      sanitized.implementationRecommendations = Object.fromEntries(
        Object.entries(record).map(([k, v]) => [
          k,
          typeof v === "string" ? sanitizeText(v) : v,
        ])
      );
    }
  }

  return sanitized;
}

export function detectPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

export function draftHasInjectionWarning(draft: {
  summary: string;
  practicalExplanation: string;
  bestPractices: unknown;
  securityConsiderations: unknown;
}): boolean {
  const chunks: string[] = [draft.summary, draft.practicalExplanation];

  for (const field of [draft.bestPractices, draft.securityConsiderations]) {
    if (Array.isArray(field)) {
      chunks.push(...field.map(String));
    }
  }

  return chunks.some((chunk) => detectPromptInjection(chunk));
}
