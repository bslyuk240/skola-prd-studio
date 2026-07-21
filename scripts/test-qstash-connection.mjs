import { config } from "dotenv";

config({ path: ".env.local", override: true });

const token = process.env.UPSTASH_QSTASH_TOKEN;
const secret = process.env.EIE_INTERNAL_WEBHOOK_SECRET;
const siteUrl = (
  process.env.URL ??
  process.env.DEPLOY_PRIME_URL ??
  process.env.NEXT_PUBLIC_APP_URL
)?.replace(/\/$/, "");

function missing() {
  return [
    !token && "UPSTASH_QSTASH_TOKEN",
    !secret && "EIE_INTERNAL_WEBHOOK_SECRET",
    !siteUrl && "URL (or NEXT_PUBLIC_APP_URL)",
  ].filter(Boolean);
}

async function main() {
  const unset = missing();
  if (unset.length > 0) {
    console.error("Missing:", unset.join(", "));
    process.exit(1);
  }

  if (siteUrl.includes("localhost") || siteUrl.includes("127.0.0.1")) {
    console.warn(
      "Warning: QStash cannot reach localhost. Use a public URL (Netlify deploy) for async callbacks."
    );
    console.warn("Local dev will fall back to inline processing if publish fails.");
  }

  const destination = `${siteUrl}/api/admin/eie/internal/process`;
  const qstashBase =
    process.env.QSTASH_URL?.replace(/\/$/, "") ??
    process.env.UPSTASH_QSTASH_URL?.replace(/\/$/, "") ??
    "https://qstash-eu-central-1.upstash.io";
  const publishUrl = `${qstashBase}/v2/publish/${destination}`;

  const response = await fetch(publishUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Upstash-Forward-x-eie-internal-secret": secret,
    },
    body: JSON.stringify({ sourceId: "00000000-0000-0000-0000-000000000000" }),
  });

  const body = await response.text();

  if (response.status === 401 || response.status === 403) {
    console.error("QStash auth failed. Check UPSTASH_QSTASH_TOKEN.");
    console.error(body);
    process.exit(1);
  }

  if (response.ok) {
    console.log(JSON.stringify({ ok: true, mode: "qstash", destination, status: response.status }, null, 2));
    console.log("Publish succeeded. Webhook may 422 on fake sourceId — that confirms delivery path.");
    return;
  }

  console.error("QStash publish failed:", response.status, body);
  process.exit(1);
}

main();
