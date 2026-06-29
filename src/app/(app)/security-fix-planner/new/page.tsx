"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Shield, GitBranch, FileText, Loader2, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function NewSecurityScanPage() {
  const router = useRouter();
  const [provider, setProvider] = useState<"github" | "manual">("github");
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [accessToken, setAccessToken] = useState("");
  const [manualContext, setManualContext] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  async function startScan() {
    if (provider === "github" && !repoUrl.trim()) {
      toast.error("Please enter a GitHub repository URL.");
      return;
    }
    if (provider === "manual" && !manualContext.trim()) {
      toast.error("Please paste your project context.");
      return;
    }
    setScanning(true);
    setError("");
    try {
      const res = await fetch("/api/security-scan/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, repoUrl, branch, accessToken: accessToken || undefined, manualContext }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scan failed");
      toast.success("Scan complete!");
      router.push(`/security-fix-planner/${data.scanId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scan failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">New Security Scan</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Connect your project to scan for security gaps and generate a Security Fix PRD.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-10 space-y-6">

        {/* Provider toggle — full width, 2 equal columns */}
        <div className="grid grid-cols-2 gap-4">
          {[
            {
              id: "github",
              icon: GitBranch,
              label: "GitHub Repository",
              desc: "Auto-detect stack, read key files, apply 10 security packs",
            },
            {
              id: "manual",
              icon: FileText,
              label: "Paste Project Context",
              desc: "README, file structure, stack info — no repo access needed",
            },
          ].map(({ id, icon: Icon, label, desc }) => (
            <button
              key={id}
              type="button"
              onClick={() => setProvider(id as "github" | "manual")}
              className={cn(
                "text-left border rounded-lg p-5 transition-colors",
                provider === id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              )}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">{label}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </button>
          ))}
        </div>

        {/* GitHub fields */}
        {provider === "github" && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="repoUrl">
                GitHub Repository URL <span className="text-destructive">*</span>
              </Label>
              <Input
                id="repoUrl"
                placeholder="https://github.com/your-org/your-repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Public repos scan without a token. Private repos require a Personal Access Token.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="branch">Branch</Label>
                <Input
                  id="branch"
                  placeholder="main"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="token">
                  Personal Access Token{" "}
                  <span className="text-xs text-muted-foreground font-normal">(private repos only)</span>
                </Label>
                <div className="relative">
                  <Input
                    id="token"
                    type={showToken ? "text" : "password"}
                    placeholder="ghp_xxxxxxxxxxxx"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 bg-muted/50 border border-border rounded-lg p-4">
              <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground">Read-only access only.</span>{" "}
                We scan: file tree, package.json, README, schema files, middleware, next.config, .env.example.
                We never read .env files. Detected secrets are redacted before being sent to AI.
              </p>
            </div>
          </div>
        )}

        {/* Manual context */}
        {provider === "manual" && (
          <div className="space-y-2">
            <Label htmlFor="manualCtx">
              Project Context <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="manualCtx"
              placeholder={`Paste anything that describes your project. More detail = better findings.

Stack: Next.js 14, TypeScript, Supabase, Tailwind, Clerk auth

File structure:
src/app/
  api/
    auth/
    staff/
    rotas/
    exports/
  dashboard/
  admin/
  staff/

Database tables: users, staff, services, rotas, shifts, assignments

Features: Staff login, rota generation, PDF export, manager approval, admin panel

Current security: Clerk auth, Supabase RLS enabled on some tables`}
              rows={18}
              value={manualContext}
              onChange={(e) => setManualContext(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Include your stack, file structure, database tables, existing auth setup, and any known security measures.
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={startScan} disabled={scanning} className="gap-2 min-w-44">
            {scanning ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Scanning & Analysing…</>
            ) : (
              <><Shield className="w-4 h-4" /> Start Security Scan</>
            )}
          </Button>
        </div>
      </div>

      {/* Scanning progress */}
      {scanning && (
        <div className="mt-6 bg-muted/50 border border-border rounded-xl p-6">
          <p className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Scanning in progress
          </p>
          <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
            {[
              "Fetching file tree",
              "Reading key files",
              "Applying 10 security packs",
              "Classifying findings",
              "Generating Security Fix PRD",
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2.5">
                <div className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </div>
                <span className="text-xs text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Takes 30–60 seconds. You will be redirected when the scan is complete.
          </p>
        </div>
      )}
    </div>
  );
}
