"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { FeatureWizardData, ScanResult } from "../feature-wizard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { GitBranch, FileText, Loader2, Shield, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  data: FeatureWizardData;
  update: (partial: Partial<FeatureWizardData>) => void;
  onNext: (result: ScanResult) => void;
}

export function StepConnect({ data, update, onNext }: Props) {
  const [scanning, setScanning] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [scanError, setScanError] = useState("");

  async function scan() {
    if (data.provider === "github" && !data.repoUrl.trim()) {
      toast.error("Please enter a GitHub repository URL.");
      return;
    }
    if (data.provider === "manual" && !data.manualContext.trim()) {
      toast.error("Please paste your project context.");
      return;
    }

    setScanning(true);
    setScanError("");
    try {
      const res = await fetch("/api/feature/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: data.provider,
          repoUrl: data.repoUrl,
          branch: data.branch || "main",
          accessToken: data.accessToken || undefined,
          manualContext: data.manualContext || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Scan failed");
      toast.success("Project scanned successfully!");
      onNext(json as ScanResult);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scan failed";
      setScanError(msg);
      toast.error(msg);
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1">Connect Existing Project</h2>
        <p className="text-muted-foreground text-sm">
          Connect your project so we can understand what already exists before planning the new feature.
        </p>
      </div>

      {/* Input method toggle */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { id: "github", icon: GitBranch, label: "GitHub Repository", desc: "Auto-scan your repo — detects stack, routes, schema, and modules" },
          { id: "manual", icon: FileText, label: "Paste Project Context", desc: "Paste README, schema, file structure, or any relevant project info" },
        ].map(({ id, icon: Icon, label, desc }) => (
          <button
            key={id}
            type="button"
            onClick={() => update({ provider: id as "github" | "manual" })}
            className={cn(
              "text-left border rounded-lg p-4 transition-colors",
              data.provider === id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">{label}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
          </button>
        ))}
      </div>

      {/* GitHub fields */}
      {data.provider === "github" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="repoUrl">GitHub Repository URL <span className="text-destructive">*</span></Label>
            <Input
              id="repoUrl"
              placeholder="https://github.com/your-org/your-repo"
              value={data.repoUrl}
              onChange={(e) => update({ repoUrl: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Public repos scan automatically. Private repos need a Personal Access Token below.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="branch">Branch</Label>
              <Input
                id="branch"
                placeholder="main"
                value={data.branch}
                onChange={(e) => update({ branch: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="token">
                Personal Access Token
                <span className="text-xs text-muted-foreground ml-1">(private repos only)</span>
              </Label>
              <div className="relative">
                <Input
                  id="token"
                  type={showToken ? "text" : "password"}
                  placeholder="ghp_xxxxxxxxxxxx"
                  value={data.accessToken}
                  onChange={(e) => update({ accessToken: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Security note */}
          <div className="flex items-start gap-2.5 bg-muted/50 border border-border rounded-lg p-3">
            <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Read-only access only</p>
              <p>We scan your file tree and key files (package.json, README, schema files). We never access .env files or read secrets. Detected secrets in scanned files are automatically redacted before being sent to AI.</p>
            </div>
          </div>
        </div>
      )}

      {/* Manual paste */}
      {data.provider === "manual" && (
        <div className="space-y-2">
          <Label htmlFor="manualContext">Project Context <span className="text-destructive">*</span></Label>
          <Textarea
            id="manualContext"
            placeholder={`Paste anything that describes your existing project. For example:

## Stack
- Next.js 14, TypeScript
- Supabase (PostgreSQL)
- Clerk auth
- Tailwind + shadcn/ui

## Current modules
- Dashboard
- Staff management
- Rota generator
- Export system

## Database tables
- users, staff, services, rotas, rota_assignments, shifts

## Key file structure
src/app/
  dashboard/
  staff/
  rotas/
  api/
    staff/
    rotas/`}
            rows={14}
            value={data.manualContext}
            onChange={(e) => update({ manualContext: e.target.value })}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">The more context you provide, the more accurate the impact analysis will be.</p>
        </div>
      )}

      {scanError && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Scan failed</p>
            <p className="text-xs text-red-700 mt-0.5">{scanError}</p>
            {scanError.includes("404") && (
              <p className="text-xs text-red-700 mt-1">Tip: Check that the repo URL is correct and the branch name matches (try &quot;master&quot; instead of &quot;main&quot;).</p>
            )}
            {scanError.includes("401") || scanError.includes("403") ? (
              <p className="text-xs text-red-700 mt-1">Tip: This is a private repo. Add a GitHub Personal Access Token with &quot;repo&quot; read scope.</p>
            ) : null}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={scan} disabled={scanning} className="gap-2 min-w-36">
          {scanning ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Scanning…</>
          ) : (
            "Scan Project →"
          )}
        </Button>
      </div>
    </div>
  );
}
