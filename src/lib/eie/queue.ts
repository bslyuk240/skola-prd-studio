import { processSource } from "@/lib/eie/orchestrator";

export type QueueDispatchMode = "qstash" | "inline";

/**
 * Async job dispatch for EIE ingestion.
 *
 * Production: Upstash QStash POST → `/api/admin/eie/internal/process`
 * Local/dev: inline fire-and-forget when QStash env vars are missing
 */
export async function dispatchSourceProcessing(
  sourceId: string
): Promise<{ mode: QueueDispatchMode }> {
  const qstashToken = process.env.UPSTASH_QSTASH_TOKEN;
  const webhookSecret = process.env.EIE_INTERNAL_WEBHOOK_SECRET;
  const siteUrl =
    process.env.URL ??
    process.env.DEPLOY_PRIME_URL ??
    process.env.NEXT_PUBLIC_APP_URL;

  if (qstashToken && webhookSecret && siteUrl) {
    const destination = `${siteUrl.replace(/\/$/, "")}/api/admin/eie/internal/process`;
    const qstashBase =
      process.env.QSTASH_URL?.replace(/\/$/, "") ??
      process.env.UPSTASH_QSTASH_URL?.replace(/\/$/, "") ??
      "https://qstash.upstash.io";
    const publishUrl = `${qstashBase}/v2/publish/${destination}`;

    const response = await fetch(publishUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${qstashToken}`,
        "Content-Type": "application/json",
        "Upstash-Forward-x-eie-internal-secret": webhookSecret,
      },
      body: JSON.stringify({ sourceId }),
    });

    if (response.ok) {
      return { mode: "qstash" };
    }

    const errorBody = await response.text();
    console.error("[eie] QStash publish failed:", response.status, errorBody);
  }

  void processSource(sourceId).catch((error) => {
    console.error(`[eie] inline processing failed for ${sourceId}:`, error);
  });

  return { mode: "inline" };
}
