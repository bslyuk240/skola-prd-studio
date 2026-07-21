export function formatTradeOffLine(item: unknown): string {
  if (typeof item === "string") return item;
  if (item && typeof item === "object" && "alternative" in item) {
    const tradeOff = item as { alternative: string; pro?: string; con?: string };
    const pro = tradeOff.pro?.trim() || "n/a";
    const con = tradeOff.con?.trim() || "n/a";
    return `${tradeOff.alternative}: pro — ${pro}; con — ${con}`;
  }
  return JSON.stringify(item);
}

export function formatTradeOffsAsLines(value: unknown): string {
  if (!Array.isArray(value)) return String(value ?? "");
  return value.map(formatTradeOffLine).join("\n");
}

export function formatStringArrayAsLines(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join("\n");
  }
  return String(value ?? "");
}

function formatRecordEntry(key: string, value: unknown): string {
  if (typeof value === "string") return `${key}: ${value}`;
  if (Array.isArray(value)) {
    return `${key}: ${value.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join("; ")}`;
  }
  if (value && typeof value === "object") {
    return `${key}: ${JSON.stringify(value)}`;
  }
  return `${key}: ${String(value ?? "")}`;
}

export function formatImplementationRecommendationsAsLines(value: unknown): string {
  if (Array.isArray(value)) {
    return formatStringArrayAsLines(value);
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (Array.isArray(record.recommendations)) {
      return formatStringArrayAsLines(record.recommendations);
    }

    const entries = Object.entries(record).filter(([key]) => key !== "recommendations");
    if (entries.length > 0) {
      return entries.map(([key, entryValue]) => formatRecordEntry(key, entryValue)).join("\n");
    }
  }

  if (typeof value === "string") return value;
  return "";
}
