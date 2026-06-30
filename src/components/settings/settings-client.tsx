"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { UserButton } from "@clerk/nextjs";
import {
  User, Key, Bot, Shield, Palette, Zap,
  Check, ExternalLink,
  CheckCircle2, XCircle, Loader2,
  FileText, GitBranch,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "account", label: "Account", icon: User },
  { id: "api", label: "API Keys", icon: Key },
  { id: "ai", label: "AI Model", icon: Bot },
  { id: "security", label: "Security Defaults", icon: Shield },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "usage", label: "Usage", icon: Zap },
] as const;

type Tab = typeof TABS[number]["id"];

export const MODELS = [
  { id: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash", provider: "Google", speed: "Fast", quality: "High", recommended: true },
  { id: "google/gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", provider: "Google", speed: "Very Fast", quality: "Good", recommended: false },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI", speed: "Fast", quality: "Good", recommended: false },
  { id: "openai/gpt-4o", label: "GPT-4o", provider: "OpenAI", speed: "Medium", quality: "Excellent", recommended: false },
  { id: "anthropic/claude-sonnet-4-5", label: "Claude Sonnet 4.5", provider: "Anthropic", speed: "Medium", quality: "Excellent", recommended: false },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", provider: "Meta", speed: "Fast", quality: "Good", recommended: false },
];

export const SEC_TOGGLE_LABELS: Record<string, string> = {
  serverSideValidation: "Server-side Validation",
  inputSanitisation: "Input Sanitisation",
  rateLimiting: "Rate Limiting",
  accountLockout: "Account Lockout",
  passwordHashing: "Password Hashing",
  safeErrorMessages: "Safe Error Messages",
  rbac: "Role-Based Access Control",
  auditLogging: "Audit Logging",
  secureFileUploads: "Secure File Uploads",
  secureSessionHandling: "Secure Session Handling",
  envVarProtection: "Env Variable Protection",
};

const DEFAULT_SEC_TOGGLES: Record<string, boolean> = {
  serverSideValidation: true,
  inputSanitisation: true,
  rateLimiting: true,
  accountLockout: true,
  passwordHashing: true,
  safeErrorMessages: true,
  rbac: true,
  auditLogging: false,
  secureFileUploads: false,
  secureSessionHandling: true,
  envVarProtection: true,
};

interface Props {
  user: { name: string; email: string; imageUrl: string; id: string };
  prefs: {
    aiModel: string;
    defaultSecurityLevel: "basic" | "standard" | "high" | "enterprise";
    defaultSecurityToggles: Record<string, boolean> | null;
    wordCountVisible: boolean;
    autoRefresh: boolean;
  };
  envStatus: { hasOpenRouter: boolean; hasDatabase: boolean; hasClerk: boolean };
}

const DOC_LABELS: Record<string, string> = {
  prd: "PRD", trd: "TRD", app_flow: "App Flow", ux_brief: "UI/UX Brief",
  backend_schema: "Backend Schema", implementation_plan: "Implementation Plan",
  security_blueprint: "Security Blueprint",
};

const FEAT_LABELS: Record<string, string> = {
  feature_prd: "Feature PRD", impact_analysis: "Impact Analysis",
  schema_changes: "Schema Changes", api_changes: "API Changes",
  ui_changes: "UI Changes", security_checklist: "Security Checklist",
  implementation_tasks: "Implementation Tasks", test_plan: "Test Plan",
  deployment_plan: "Deployment Plan",
};

interface UsageDetail {
  totalConsumed: number;
  limit: number;
  remaining: number;
  percentage: number;
  breakdown: { blueprintCredits: number; featureCredits: number; securityCredits: number };
  blueprintDocs: { id: string; type: string; projectName: string; wordCount: number | null; aiCreditsUsed: number | null }[];
  featureDocs: { id: string; type: string; featureName: string; wordCount: number | null; aiCreditsUsed: number | null }[];
  scans: { id: string; provider: string; repoOwner: string | null; repoName: string | null; safeToShipScore: number | null; aiCreditsUsed: number | null }[];
}

function UsageTabContent() {
  const [data, setData] = useState<UsageDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/credits/detail")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="h-8 bg-muted rounded-lg animate-pulse" />
        <div className="h-24 bg-muted rounded-xl animate-pulse" />
        <div className="h-32 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!data) return <p className="text-sm text-muted-foreground">Failed to load usage data.</p>;

  const { totalConsumed, limit, remaining, percentage, breakdown, blueprintDocs, featureDocs, scans } = data;
  const isWarning = percentage >= 70;
  const isCritical = percentage >= 90;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">AI Credit Usage</h2>
        <p className="text-muted-foreground text-sm mt-0.5">Track generation consumption across all features.</p>
      </div>

      {/* Total bar */}
      <Card className={cn(isCritical && "border-red-200")}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Consumed</span>
            <Zap className={cn("w-4 h-4", isCritical ? "text-red-500" : isWarning ? "text-amber-500" : "text-muted-foreground")} />
          </div>
          <div className="flex items-end gap-2 mb-2">
            <p className={cn("text-3xl font-bold", isCritical ? "text-red-600" : isWarning ? "text-amber-500" : "text-foreground")}>
              {totalConsumed.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground mb-1">/ {limit.toLocaleString()}</p>
          </div>
          <Progress value={percentage} className={cn("h-2 mb-2", isCritical ? "[&>div]:bg-red-500" : isWarning ? "[&>div]:bg-amber-500" : "")} />
          <p className="text-xs text-muted-foreground">{remaining} credits remaining</p>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Blueprint Docs", value: breakdown.blueprintCredits, icon: FileText },
          { label: "Feature Docs", value: breakdown.featureCredits, icon: GitBranch },
          { label: "Security Scans", value: breakdown.securityCredits, icon: Shield },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
                <Icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-3xl font-bold text-foreground">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Breakdown bar */}
      {totalConsumed > 0 && (
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">Usage Breakdown</p>
            <div className="space-y-3">
              {[
                { label: "Blueprint Documents", value: breakdown.blueprintCredits, color: "bg-blue-500" },
                { label: "Feature Documents", value: breakdown.featureCredits, color: "bg-emerald-500" },
                { label: "Security Scans", value: breakdown.securityCredits, color: "bg-red-500" },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium text-foreground">{value} credits</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", color)}
                      style={{ width: `${Math.round((value / totalConsumed) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Blueprint doc log */}
      {blueprintDocs.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" /> Blueprint Document Generations
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="space-y-2">
              {blueprintDocs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">{DOC_LABELS[doc.type] ?? doc.type}</Badge>
                    <span className="text-sm text-muted-foreground truncate max-w-[180px]">{doc.projectName}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {doc.wordCount ? <span className="text-xs text-muted-foreground">{doc.wordCount.toLocaleString()} words</span> : null}
                    <span className="text-xs font-semibold text-foreground">{doc.aiCreditsUsed} credits</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feature doc log */}
      {featureDocs.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-emerald-600" /> Feature Document Generations
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="space-y-2">
              {featureDocs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">{FEAT_LABELS[doc.type] ?? doc.type}</Badge>
                    <span className="text-sm text-muted-foreground truncate max-w-[180px]">{doc.featureName}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {doc.wordCount ? <span className="text-xs text-muted-foreground">{doc.wordCount.toLocaleString()} words</span> : null}
                    <span className="text-xs font-semibold text-foreground">{doc.aiCreditsUsed} credits</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security scan log */}
      {scans.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-600" /> Security Scans
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="space-y-2">
              {scans.map((scan) => (
                <div key={scan.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs capitalize">{scan.provider}</Badge>
                    <span className="text-sm text-muted-foreground truncate max-w-[180px]">
                      {scan.repoName ? `${scan.repoOwner}/${scan.repoName}` : "Manual context scan"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {scan.safeToShipScore != null && (
                      <span className="text-xs text-muted-foreground">{scan.safeToShipScore}/100</span>
                    )}
                    <span className="text-xs font-semibold text-foreground">{scan.aiCreditsUsed} credits</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {totalConsumed === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Zap className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold text-foreground mb-1">No usage yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Generate blueprint documents, feature plans, or run a security scan to see credit consumption here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
    : <XCircle className="w-4 h-4 text-red-600 shrink-0" />;
}

export function SettingsClient({ user, prefs, envStatus }: Props) {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>("account");

  // AI model
  const [selectedModel, setSelectedModel] = useState(
    // Migrate old invalid model ID to new default
    prefs.aiModel === "google/gemini-2.0-flash-001" ? "google/gemini-3.5-flash" : prefs.aiModel
  );
  const [savingModel, setSavingModel] = useState(false);

  // Security defaults
  const [defaultSecLevel, setDefaultSecLevel] = useState(prefs.defaultSecurityLevel);
  const [secToggles, setSecToggles] = useState<Record<string, boolean>>(
    prefs.defaultSecurityToggles ?? DEFAULT_SEC_TOGGLES
  );
  const [savingSec, setSavingSec] = useState(false);

  // Appearance
  const [wordCountVisible, setWordCountVisible] = useState(prefs.wordCountVisible);
  const [autoRefresh, setAutoRefresh] = useState(prefs.autoRefresh);
  const [savingAppearance, setSavingAppearance] = useState(false);

  async function patchPrefs(data: Record<string, unknown>) {
    const res = await fetch("/api/user/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to save");
  }

  async function saveModel() {
    setSavingModel(true);
    try {
      await patchPrefs({ aiModel: selectedModel });
      toast.success("AI model preference saved. New documents will use this model.");
    } catch {
      toast.error("Failed to save model preference.");
    } finally {
      setSavingModel(false);
    }
  }

  async function saveSecDefaults() {
    setSavingSec(true);
    try {
      await patchPrefs({ defaultSecurityLevel: defaultSecLevel, defaultSecurityToggles: secToggles });
      toast.success("Security defaults saved. New blueprints will use these settings.");
    } catch {
      toast.error("Failed to save security defaults.");
    } finally {
      setSavingSec(false);
    }
  }

  async function saveAppearance() {
    setSavingAppearance(true);
    try {
      await patchPrefs({ wordCountVisible, autoRefresh });
      toast.success("Appearance preferences saved.");
    } catch {
      toast.error("Failed to save preferences.");
    } finally {
      setSavingAppearance(false);
    }
  }

  return (
    <div className="flex h-full">
      {/* Left nav */}
      <aside className="w-52 shrink-0 border-r border-border p-4">
        <h1 className="text-lg font-bold text-foreground px-3 mb-4">Settings</h1>
        <nav className="space-y-0.5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
                activeTab === id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">

        {/* ── Account ── */}
        {activeTab === "account" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Account</h2>
              <p className="text-muted-foreground text-sm mt-0.5">Your profile and account details.</p>
            </div>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary shrink-0">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-base">{user.name}</p>
                    <p className="text-muted-foreground text-sm">{user.email}</p>
                    <p className="text-xs text-muted-foreground/60 font-mono mt-0.5">{user.id}</p>
                  </div>
                </div>
                <Separator className="mb-5" />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Profile, email & password</p>
                      <p className="text-xs text-muted-foreground">Click the avatar to update name, email, or password via Clerk</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Manage →</span>
                      <UserButton />
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">User ID</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5 break-all">{user.id}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { navigator.clipboard.writeText(user.id); toast.success("User ID copied!"); }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-destructive/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-destructive">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Delete Account</p>
                    <p className="text-xs text-muted-foreground">Permanently delete your account and all projects. This cannot be undone.</p>
                  </div>
                  <Button size="sm" variant="destructive" disabled>Delete Account</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── API Keys ── */}
        {activeTab === "api" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">API Keys</h2>
              <p className="text-muted-foreground text-sm mt-0.5">
                These keys are configured in your <code className="text-xs bg-muted px-1 py-0.5 rounded">.env.local</code> file. Edit that file to change them — they cannot be changed from the UI at runtime for security reasons.
              </p>
            </div>

            {/* OpenRouter */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <StatusDot ok={envStatus.hasOpenRouter} />
                  <CardTitle className="text-sm font-semibold">OpenRouter API Key</CardTitle>
                  {envStatus.hasOpenRouter
                    ? <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50 ml-auto">Configured</Badge>
                    : <Badge variant="outline" className="text-xs text-red-600 border-red-200 bg-red-50 ml-auto">Missing</Badge>}
                </div>
                <CardDescription className="text-xs mt-1">
                  Used to generate all 7 build documents via AI.{" "}
                  <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                    Get a key at openrouter.ai <ExternalLink className="w-3 h-3" />
                  </a>
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6 space-y-3">
                <div className="bg-muted/60 rounded-lg p-4 font-mono text-xs text-muted-foreground">
                  OPENROUTER_API_KEY={envStatus.hasOpenRouter ? "sk-or-v1-••••••••••••••••" : "<not set>"}
                </div>
                {!envStatus.hasOpenRouter && (
                  <p className="text-xs text-red-600 font-medium">
                    ⚠ Add OPENROUTER_API_KEY to your .env.local file then restart the dev server. Document generation will not work without this.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  To update: edit <code className="bg-muted px-1 rounded">.env.local</code> → set <code className="bg-muted px-1 rounded">OPENROUTER_API_KEY=your_key</code> → restart the server.
                </p>
              </CardContent>
            </Card>

            {/* Neon */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <StatusDot ok={envStatus.hasDatabase} />
                  <CardTitle className="text-sm font-semibold">Neon Database</CardTitle>
                  {envStatus.hasDatabase
                    ? <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50 ml-auto">Configured</Badge>
                    : <Badge variant="outline" className="text-xs text-red-600 border-red-200 bg-red-50 ml-auto">Missing</Badge>}
                </div>
                <CardDescription className="text-xs mt-1">PostgreSQL serverless database for all projects and documents.</CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="bg-muted/60 rounded-lg p-4 font-mono text-xs text-muted-foreground">
                  DATABASE_URL={envStatus.hasDatabase ? "postgresql://••••@••••.neon.tech/neondb" : "<not set>"}
                </div>
                {!envStatus.hasDatabase && (
                  <p className="text-xs text-red-600 font-medium mt-2">
                    ⚠ Add DATABASE_URL to your .env.local. Get a free database at neon.tech.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Clerk */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <StatusDot ok={envStatus.hasClerk} />
                  <CardTitle className="text-sm font-semibold">Clerk Authentication</CardTitle>
                  {envStatus.hasClerk
                    ? <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50 ml-auto">Configured</Badge>
                    : <Badge variant="outline" className="text-xs text-red-600 border-red-200 bg-red-50 ml-auto">Missing</Badge>}
                </div>
                <CardDescription className="text-xs mt-1">Handles sign-up, sign-in, and user session management.</CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="bg-muted/60 rounded-lg p-4 font-mono text-xs text-muted-foreground">
                  CLERK_SECRET_KEY={envStatus.hasClerk ? "sk_test_••••••••••••••••" : "<not set>"}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── AI Model ── */}
        {activeTab === "ai" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">AI Model</h2>
              <p className="text-muted-foreground text-sm mt-0.5">
                Choose which model is used when generating documents. Your preference is saved and applied to all new generation requests.
              </p>
            </div>

            <div className="space-y-3">
              {MODELS.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => setSelectedModel(model.id)}
                  className={cn(
                    "w-full text-left border rounded-xl p-4 transition-colors",
                    selectedModel === model.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                        selectedModel === model.id ? "border-primary" : "border-muted-foreground/40"
                      )}>
                        {selectedModel === model.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">{model.label}</span>
                          {model.recommended && (
                            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30 py-0">Recommended</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{model.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs shrink-0">
                      <div className="text-center">
                        <p className="text-muted-foreground">Speed</p>
                        <p className="font-medium text-foreground">{model.speed}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground">Quality</p>
                        <p className="font-medium text-foreground">{model.quality}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground">Provider</p>
                        <p className="font-medium text-foreground">{model.provider}</p>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="bg-muted/50 border border-border rounded-xl p-4">
              <p className="text-xs font-medium text-foreground mb-1">How this works</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                When you click Generate on any document, the API reads your saved model preference from the database and uses it for that generation. Changing the model here takes effect immediately for the next generation you run.
              </p>
            </div>

            <Button onClick={saveModel} disabled={savingModel} className="gap-2">
              {savingModel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save Model Preference
            </Button>
          </div>
        )}

        {/* ── Security Defaults ── */}
        {activeTab === "security" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Security Defaults</h2>
              <p className="text-muted-foreground text-sm mt-0.5">
                These settings pre-fill the Security Level step in the New Blueprint Wizard for every new project you create.
              </p>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Default Security Level</CardTitle>
                <CardDescription className="text-xs">Applied automatically when you start the blueprint wizard.</CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="grid grid-cols-4 gap-2">
                  {(["basic", "standard", "high", "enterprise"] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setDefaultSecLevel(level)}
                      className={cn(
                        "border rounded-lg px-3 py-2.5 text-xs font-semibold capitalize transition-colors",
                        defaultSecLevel === level
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      )}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Default Security Controls</CardTitle>
                <CardDescription className="text-xs">
                  These will be pre-toggled in Step 4 of the wizard. You can always override them per project.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-4">
                <div className="divide-y divide-border">
                  {Object.entries(SEC_TOGGLE_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between py-3">
                      <span className="text-sm text-foreground">{label}</span>
                      <Switch
                        checked={!!secToggles[key]}
                        onCheckedChange={(v) => setSecToggles((p) => ({ ...p, [key]: v }))}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Button onClick={saveSecDefaults} disabled={savingSec} className="gap-2">
              {savingSec ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save Security Defaults
            </Button>
          </div>
        )}

        {/* ── Usage ── */}
        {activeTab === "usage" && <UsageTabContent />}

        {/* ── Appearance ── */}
        {activeTab === "appearance" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Appearance</h2>
              <p className="text-muted-foreground text-sm mt-0.5">Customise how the app looks and behaves.</p>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Theme</CardTitle>
                <CardDescription className="text-xs">Choose between light, dark, or system theme.</CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "light", label: "Light", previewClass: "bg-white" },
                    { id: "dark", label: "Dark", previewClass: "bg-zinc-900" },
                    { id: "system", label: "System", previewClass: "bg-gradient-to-br from-white via-zinc-300 to-zinc-900" },
                  ].map(({ id, label, previewClass }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTheme(id)}
                      className={cn(
                        "border rounded-xl p-3 text-left transition-colors",
                        theme === id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                      )}
                    >
                      <div className={cn("w-full h-12 rounded-lg mb-2 border border-border/40", previewClass)} />
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-foreground">{label}</p>
                        {theme === id && <Check className="w-3.5 h-3.5 text-primary" />}
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">Theme is applied immediately and persisted by next-themes in your browser.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Document Display</CardTitle>
                <CardDescription className="text-xs">Control what appears on document cards and pages.</CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Word count on document cards</p>
                    <p className="text-xs text-muted-foreground">Show word count next to document status badges</p>
                  </div>
                  <Switch
                    checked={wordCountVisible}
                    onCheckedChange={setWordCountVisible}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Auto-refresh after generation</p>
                    <p className="text-xs text-muted-foreground">Automatically reload the documents page when generation completes</p>
                  </div>
                  <Switch
                    checked={autoRefresh}
                    onCheckedChange={setAutoRefresh}
                  />
                </div>
              </CardContent>
            </Card>

            <Button onClick={saveAppearance} disabled={savingAppearance} className="gap-2">
              {savingAppearance ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save Preferences
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
