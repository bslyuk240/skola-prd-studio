"use client";

import {
  CheckCircle2,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EnvConnectionStatus } from "@/lib/env-status";
import { isEiePipelineConfigured, isStorageConfigured } from "@/lib/env-status";

function StatusDot({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
    : <XCircle className="w-4 h-4 text-red-600 shrink-0" />;
}

function StatusBadge({ ok, optional }: { ok: boolean; optional?: boolean }) {
  if (ok) {
    return (
      <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50 ml-auto">
        Configured
      </Badge>
    );
  }
  if (optional) {
    return (
      <Badge variant="outline" className="text-xs text-muted-foreground border-border ml-auto">
        Optional
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs text-red-600 border-red-200 bg-red-50 ml-auto">
      Missing
    </Badge>
  );
}

type ConnectionItem = {
  ok: boolean;
  title: string;
  description: string;
  envLine: string;
  optional?: boolean;
  warning?: string;
  link?: { href: string; label: string };
};

function ConnectionCard({ item }: { item: ConnectionItem }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <StatusDot ok={item.ok} />
          <CardTitle className="text-sm font-semibold">{item.title}</CardTitle>
          <StatusBadge ok={item.ok} optional={item.optional && !item.ok} />
        </div>
        <CardDescription className="text-xs mt-1">
          {item.description}
          {item.link ? (
            <>
              {" "}
              <a
                href={item.link.href}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-0.5"
              >
                {item.link.label} <ExternalLink className="w-3 h-3" />
              </a>
            </>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-6 space-y-3">
        <div className="bg-muted/60 rounded-lg p-4 font-mono text-xs text-muted-foreground break-all">
          {item.envLine}
        </div>
        {!item.ok && item.warning ? (
          <p className="text-xs text-red-600 font-medium">{item.warning}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SectionSummary({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      <StatusBadge ok={ok} />
    </div>
  );
}

interface Props {
  status: EnvConnectionStatus;
}

export function ConnectionsClient({ status }: Props) {
  const coreReady =
    status.core.openRouter &&
    status.core.database &&
    status.core.clerkSecret &&
    status.core.clerkPublishable;

  const eieReady = isEiePipelineConfigured(status);
  const storageReady = isStorageConfigured(status);

  const coreItems: ConnectionItem[] = [
    {
      ok: status.core.openRouter,
      title: "OpenRouter API Key",
      description: "Generates blueprint documents, feature plans, and EIE synthesis.",
      envLine: `OPENROUTER_API_KEY=${status.core.openRouter ? "sk-or-v1-••••••••••••••••" : "<not set>"}`,
      warning: "Add OPENROUTER_API_KEY to .env.local and restart the dev server.",
      link: { href: "https://openrouter.ai/keys", label: "Get a key at openrouter.ai" },
    },
    {
      ok: status.core.database,
      title: "Neon Database",
      description: "PostgreSQL serverless database for projects, documents, and EIE tables.",
      envLine: `DATABASE_URL=${status.core.database ? "postgresql://••••@••••.neon.tech/neondb" : "<not set>"}`,
      warning: "Add DATABASE_URL to .env.local. Get a free database at neon.tech.",
    },
    {
      ok: status.core.clerkSecret && status.core.clerkPublishable,
      title: "Clerk Authentication",
      description: "Sign-up, sign-in, sessions, and admin role claims.",
      envLine: `CLERK_SECRET_KEY=${status.core.clerkSecret ? "sk_test_••••••••••••••••" : "<not set>"}\nNEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${status.core.clerkPublishable ? "pk_test_••••••••••••••••" : "<not set>"}`,
      warning: "Set both Clerk keys in .env.local.",
      link: { href: "https://dashboard.clerk.com", label: "Clerk dashboard" },
    },
  ];

  const eieItems: ConnectionItem[] = [
    {
      ok: status.eie.qstashToken,
      title: "Upstash QStash",
      description: "Async ingestion queue for EIE source processing.",
      envLine: `UPSTASH_QSTASH_TOKEN=${status.eie.qstashToken ? "••••••••••••••••" : "<not set>"}`,
      optional: true,
      warning: "Required in production for async ingestion. Local dev falls back to inline processing.",
      link: { href: "https://console.upstash.com/qstash", label: "Upstash QStash console" },
    },
    {
      ok: status.eie.qstashUrl,
      title: "QStash Region URL",
      description: "Regional QStash endpoint. Defaults to Upstash global if unset.",
      envLine: `QSTASH_URL=${status.display.qstashUrl ?? "<not set — uses Upstash default>"}`,
      optional: true,
    },
    {
      ok: status.eie.internalWebhookSecret,
      title: "EIE Internal Webhook Secret",
      description: "Authenticates QStash callbacks to /api/admin/eie/internal/process.",
      envLine: `EIE_INTERNAL_WEBHOOK_SECRET=${status.eie.internalWebhookSecret ? "••••••••••••••••" : "<not set>"}`,
      optional: true,
      warning: "Generate with: node scripts/setup-qstash-env.mjs",
    },
    {
      ok: status.eie.backgroundFunctionSecret,
      title: "Background Function Secret",
      description: "HMAC auth for Netlify background document generation.",
      envLine: `BACKGROUND_FUNCTION_SECRET=${status.eie.backgroundFunctionSecret ? "••••••••••••••••" : "<not set>"}`,
      optional: true,
      warning: "Generate with: openssl rand -hex 32. Set on Netlify and locally.",
    },
    {
      ok: status.eie.appUrl,
      title: "App URL",
      description: "Public site URL for QStash callbacks and background job dispatch.",
      envLine: `NEXT_PUBLIC_APP_URL=${status.display.appUrl ?? "<not set>"}\nURL=${status.display.netlifyUrlSet ? "(set — Netlify injects this in production)" : "<not set locally>"}`,
      optional: true,
      warning: "Set NEXT_PUBLIC_APP_URL locally. Do not set URL manually on Netlify.",
    },
  ];

  const storageItems: ConnectionItem[] = [
    {
      ok: storageReady,
      title: "Cloudflare R2 Storage",
      description: "S3-compatible bucket for admin file uploads in EIE ingest.",
      envLine: [
        `EIE_STORAGE_BUCKET=${status.display.storageBucket ?? "<not set>"}`,
        `EIE_STORAGE_ENDPOINT=${status.storage.endpoint ? "https://••••.r2.cloudflarestorage.com" : "<not set>"}`,
        `EIE_STORAGE_ACCESS_KEY=${status.storage.accessKey ? "••••••••••••••••" : "<not set>"}`,
        `EIE_STORAGE_SECRET_KEY=${status.storage.secretKey ? "••••••••••••••••" : "<not set>"}`,
      ].join("\n"),
      optional: true,
      warning: "All four EIE_STORAGE_* variables are required for file uploads.",
      link: { href: "https://dash.cloudflare.com", label: "Cloudflare dashboard" },
    },
  ];

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="text-base font-semibold text-foreground">Connections</h2>
        <p className="text-muted-foreground text-sm mt-0.5">
          Environment configuration for core app services and the Engineering Intelligence Engine.
          Values are read from <code className="text-xs bg-muted px-1 py-0.5 rounded">.env.local</code>{" "}
          (local) or Netlify site settings (production). Secrets are never shown in full.
        </p>
      </div>

      <div className="space-y-3">
        <SectionSummary
          label="Core app"
          ok={coreReady}
          detail="OpenRouter, Neon, and Clerk must all be configured."
        />
        <div className="space-y-4">
          {coreItems.map((item) => (
            <ConnectionCard key={item.title} item={item} />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <SectionSummary
          label="EIE pipeline"
          ok={eieReady}
          detail="QStash token, webhook secret, and app URL required for async ingestion in production."
        />
        <div className="space-y-4">
          {eieItems.map((item) => (
            <ConnectionCard key={item.title} item={item} />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <SectionSummary
          label="File storage"
          ok={storageReady}
          detail="R2 bucket credentials for admin file upload ingest."
        />
        <div className="space-y-4">
          {storageItems.map((item) => (
            <ConnectionCard key={item.title} item={item} />
          ))}
        </div>
      </div>

      <Card className="border-border">
        <CardContent className="p-5">
          <p className="text-xs font-medium text-foreground mb-1">How to update</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Edit <code className="bg-muted px-1 rounded">.env.local</code>, restart the dev server,
            or update Netlify environment variables and redeploy. Run{" "}
            <code className="bg-muted px-1 rounded">node scripts/test-r2-connection.mjs</code> and{" "}
            <code className="bg-muted px-1 rounded">node scripts/test-qstash-connection.mjs</code>{" "}
            to verify R2 and QStash after changes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
