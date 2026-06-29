"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { SecurityScan, SecurityFinding } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Shield, XCircle, AlertTriangle, Eye, CheckCircle2,
  Lightbulb, Copy, ChevronDown, ChevronUp, Bot, FileText, Loader2, Wand2,
  RefreshCw, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { scoreLabel } from "@/lib/security-scanner";

const CONFIDENCE_CONFIG = {
  confirmed: {
    label: "Confirmed Issue",
    icon: XCircle,
    color: "text-red-700",
    bg: "bg-red-50 border-red-200",
    badge: "bg-red-100 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
  likely_gap: {
    label: "Likely Gap",
    icon: AlertTriangle,
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  needs_review: {
    label: "Needs Review",
    icon: Eye,
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  recommended: {
    label: "Recommended",
    icon: Lightbulb,
    color: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-200",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
};

const SEVERITY_CONFIG = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-amber-100 text-amber-800 border-amber-200",
  medium: "bg-blue-100 text-blue-800 border-blue-200",
  low: "bg-muted text-muted-foreground border-border",
  info: "bg-muted text-muted-foreground border-border",
};

interface Props {
  scan: SecurityScan;
  findings: SecurityFinding[];
}

type Tab = "overview" | "prd" | "agent_prompt";

export function SecurityReportClient({ scan, findings }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [agentPrompt, setAgentPrompt] = useState(scan.agentPrompt ?? "");
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    previousScore: number;
    newScore: number;
    resolved: string[];
    stillOpen: string[];
    message: string;
  } & { resolvedCount: number; stillOpenCount: number } | null>(null);

  async function verifyFixes() {
    if (!scan.repoUrl) {
      toast.error("Verification requires a GitHub repo connection.");
      return;
    }
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetch(`/api/security-scan/${scan.id}/verify`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      setVerifyResult(data);
      if (data.resolvedCount > 0) {
        toast.success(`${data.resolvedCount} finding(s) confirmed fixed!`);
      } else {
        toast.info("No change detected in the latest code.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  async function generateAgentPrompt() {
    setGeneratingPrompt(true);
    try {
      const res = await fetch(`/api/security-scan/${scan.id}/agent-prompt`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setAgentPrompt(data.agentPrompt);
      toast.success("AI Agent Prompt generated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate prompt.");
    } finally {
      setGeneratingPrompt(false);
    }
  }

  const score = scan.safeToShipScore ?? 0;
  const scoreMeta = scoreLabel(score);
  const stack = (scan.detectedStack as Record<string, string | string[]>) ?? {};

  const confirmed = findings.filter((f) => f.confidence === "confirmed");
  const likelyGaps = findings.filter((f) => f.confidence === "likely_gap");
  const needsReview = findings.filter((f) => f.confidence === "needs_review");
  const recommended = findings.filter((f) => f.confidence === "recommended");

  function toggleFinding(id: string) {
    setExpandedFindings((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-8 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/security-fix-planner">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Security Scans
            </Button>
          </Link>
          <div className="h-4 w-px bg-border" />
          <div>
            <p className="text-xs text-muted-foreground">{scan.repoUrl ?? "Manual scan"}</p>
            <h1 className="text-sm font-bold text-foreground">Security Scan Report</h1>
          </div>
        </div>
        <div className="flex gap-2">
          {scan.repoUrl && (
            <Button
              size="sm"
              variant="outline"
              onClick={verifyFixes}
              disabled={verifying}
              className="gap-1.5"
            >
              {verifying
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying…</>
                : <><RefreshCw className="w-3.5 h-3.5" /> Verify Fixes</>}
            </Button>
          )}
          {(["overview", "prd", "agent_prompt"] as Tab[]).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={activeTab === t ? "default" : "outline"}
              onClick={() => setActiveTab(t)}
              className="gap-1.5"
            >
              {t === "overview" && <><Shield className="w-3.5 h-3.5" /> Overview</>}
              {t === "prd" && <><FileText className="w-3.5 h-3.5" /> Security Fix PRD</>}
              {t === "agent_prompt" && <><Bot className="w-3.5 h-3.5" /> AI Agent Prompt</>}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {/* ── Overview tab ── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Verify result banner */}
            {verifyResult && (
              <div className={cn(
                "border rounded-xl p-5 flex items-start gap-4",
                verifyResult.resolvedCount > 0
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-amber-50 border-amber-200"
              )}>
                <TrendingUp className={cn("w-5 h-5 mt-0.5 shrink-0", verifyResult.resolvedCount > 0 ? "text-emerald-600" : "text-amber-600")} />
                <div className="flex-1 min-w-0">
                  <p className={cn("font-semibold text-sm mb-1", verifyResult.resolvedCount > 0 ? "text-emerald-800" : "text-amber-800")}>
                    {verifyResult.message}
                  </p>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-muted-foreground">
                      Score: <span className="font-bold text-foreground">{verifyResult.previousScore}</span> → <span className={cn("font-bold", verifyResult.newScore > verifyResult.previousScore ? "text-emerald-700" : "text-foreground")}>{verifyResult.newScore}</span>
                    </span>
                  </div>
                  {verifyResult.resolved.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {verifyResult.resolved.map((t) => (
                        <div key={t} className="flex items-center gap-1.5 text-xs text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {t}
                        </div>
                      ))}
                    </div>
                  )}
                  {verifyResult.stillOpen.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {verifyResult.stillOpen.map((t) => (
                        <div key={t} className="flex items-center gap-1.5 text-xs text-amber-700">
                          <XCircle className="w-3.5 h-3.5 shrink-0" /> {t} — still detected in latest code
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Score + summary */}
            <div className={cn("border rounded-xl p-6 flex items-center gap-6", scoreMeta.bgColor)}>
              <div className="text-center shrink-0">
                <div className={cn("text-5xl font-bold", scoreMeta.color)}>{score}</div>
                <div className="text-xs text-muted-foreground mt-0.5">/100</div>
              </div>
              <div>
                <p className={cn("text-xl font-bold mb-1", scoreMeta.color)}>{scoreMeta.label}</p>
                <p className="text-sm text-muted-foreground">
                  {confirmed.length} confirmed issue{confirmed.length !== 1 ? "s" : ""} ·{" "}
                  {likelyGaps.length} likely gap{likelyGaps.length !== 1 ? "s" : ""} ·{" "}
                  {needsReview.length} to review manually ·{" "}
                  {recommended.length} recommended improvement{recommended.length !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {(scan.appliedPacks as string[])?.length ?? 0} security packs applied:{" "}
                  {((scan.appliedPacks as string[]) ?? []).join(", ")}
                </p>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Confirmed Issues", count: confirmed.length, cfg: CONFIDENCE_CONFIG.confirmed },
                { label: "Likely Gaps", count: likelyGaps.length, cfg: CONFIDENCE_CONFIG.likely_gap },
                { label: "Needs Review", count: needsReview.length, cfg: CONFIDENCE_CONFIG.needs_review },
                { label: "Recommended", count: recommended.length, cfg: CONFIDENCE_CONFIG.recommended },
              ].map(({ label, count, cfg }) => {
                const Icon = cfg.icon;
                return (
                  <Card key={label}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={cn("w-4 h-4", cfg.color)} />
                        <span className="text-xs font-medium text-muted-foreground">{label}</span>
                      </div>
                      <p className={cn("text-3xl font-bold", cfg.color)}>{count}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Stack detected */}
            {Object.keys(stack).length > 0 && (
              <Card>
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-semibold">Detected Stack</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-4">
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
                    {Object.entries(stack)
                      .filter(([k, v]) => k !== "otherDeps" && v && v !== "Not detected" && v !== "None detected")
                      .map(([k, v]) => (
                        <div key={k} className="flex flex-col">
                          <span className="text-xs text-muted-foreground capitalize">{k.replace(/([A-Z])/g, " $1").trim()}</span>
                          <span className="text-xs font-semibold text-foreground">{v as string}</span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Findings by confidence tier */}
            {(["confirmed", "likely_gap", "needs_review", "recommended"] as const).map((tier) => {
              const tierFindings = findings.filter((f) => f.confidence === tier);
              if (tierFindings.length === 0) return null;
              const cfg = CONFIDENCE_CONFIG[tier];
              const Icon = cfg.icon;

              return (
                <div key={tier}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={cn("w-4 h-4", cfg.color)} />
                    <h2 className={cn("text-base font-bold", cfg.color)}>{cfg.label}</h2>
                    <Badge variant="outline" className={cn("text-xs", cfg.badge)}>{tierFindings.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {tierFindings.map((f) => {
                      const isExpanded = expandedFindings.has(f.id);
                      const sevCfg = SEVERITY_CONFIG[f.severity as keyof typeof SEVERITY_CONFIG];
                      return (
                        <div key={f.id} className={cn("border rounded-lg overflow-hidden", cfg.bg)}>
                          <button
                            type="button"
                            onClick={() => toggleFinding(f.id)}
                            className="w-full flex items-center justify-between px-4 py-3 text-left"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={cn("w-2 h-2 rounded-full shrink-0", cfg.dot)} />
                              <span className="text-sm font-semibold text-foreground truncate">{f.title}</span>
                              <Badge variant="outline" className={cn("text-xs shrink-0 capitalize", sevCfg)}>
                                {f.severity}
                              </Badge>
                              <span className="text-xs text-muted-foreground shrink-0">{f.pack}</span>
                            </div>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                          </button>
                          {isExpanded && (
                            <div className="px-4 pb-4 pt-0 space-y-3 border-t border-current/10">
                              <p className="text-sm text-foreground/90 leading-relaxed">{f.description}</p>
                              {f.codeEvidence && (
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-1">Evidence found:</p>
                                  <code className="text-xs bg-black/10 px-2 py-1 rounded font-mono">{f.codeEvidence}</code>
                                </div>
                              )}
                              {(f.affectedFiles as string[])?.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-1">Affected files:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {(f.affectedFiles as string[]).map((file) => (
                                      <code key={file} className="text-xs bg-black/10 px-1.5 py-0.5 rounded font-mono">{file}</code>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="bg-white/50 rounded-lg p-3">
                                <p className="text-xs font-semibold text-foreground mb-1">Recommendation:</p>
                                <p className="text-xs text-foreground/90 leading-relaxed">{f.recommendation}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Security Fix PRD tab ── */}
        {activeTab === "prd" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-foreground">Security Fix PRD</h2>
              {scan.prdContent && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => copyText(scan.prdContent!, "Security Fix PRD")}>
                  <Copy className="w-3.5 h-3.5" /> Copy Full PRD
                </Button>
              )}
            </div>
            {scan.prdContent ? (
              <div className="bg-card border border-border rounded-xl p-8">
                <pre className="text-sm text-foreground whitespace-pre-wrap leading-relaxed font-sans">
                  {scan.prdContent}
                </pre>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground text-sm">PRD not generated yet.</div>
            )}
          </div>
        )}

        {/* ── AI Agent Prompt tab ── */}
        {activeTab === "agent_prompt" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-semibold text-foreground">AI Agent Prompt</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Paste this into Cursor, Claude Code, Windsurf, or any AI coding agent to implement the security fixes.
                </p>
              </div>
              <div className="flex gap-2">
                {agentPrompt && (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => copyText(agentPrompt, "Agent prompt")}>
                    <Copy className="w-3.5 h-3.5" /> Copy Prompt
                  </Button>
                )}
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={generateAgentPrompt}
                  disabled={generatingPrompt || !scan.prdContent}
                >
                  {generatingPrompt
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                    : <><Wand2 className="w-3.5 h-3.5" /> {agentPrompt ? "Regenerate" : "Generate Prompt"}</>}
                </Button>
              </div>
            </div>

            {agentPrompt ? (
              <div className="bg-zinc-950 rounded-xl p-6">
                <pre className="text-sm text-zinc-100 whitespace-pre-wrap leading-relaxed font-mono">
                  {agentPrompt}
                </pre>
              </div>
            ) : (
              <div className="border-2 border-dashed border-border rounded-xl p-16 text-center">
                <Bot className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm font-semibold text-foreground mb-1">No agent prompt yet</p>
                <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
                  {scan.prdContent
                    ? "Click Generate Prompt to create a ready-to-paste implementation prompt from your Security Fix PRD."
                    : "Generate the Security Fix PRD first, then come back here to generate the agent prompt."}
                </p>
                {scan.prdContent && (
                  <Button size="sm" className="gap-2" onClick={generateAgentPrompt} disabled={generatingPrompt}>
                    {generatingPrompt
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                      : <><Wand2 className="w-4 h-4" /> Generate Agent Prompt</>}
                  </Button>
                )}
              </div>
            )}

            <div className="mt-6 border border-border rounded-lg p-4 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-2">Steps to apply:</p>
              <ol className="space-y-1 list-decimal list-inside">
                <li>Copy the prompt</li>
                <li>Open Cursor, Claude Code, or Windsurf with the repo folder open</li>
                <li>Paste the prompt — the agent will work through fixes in priority order</li>
                <li>Review each diff before committing, particularly auth and database changes</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
