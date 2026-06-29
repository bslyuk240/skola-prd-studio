"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { FeatureRequest, FeatureDocument, FeatureTask, RepoConnection } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, FileText, Shield, Database, Map, Palette,
  Code2, GitBranch, CheckSquare, Rocket, Loader2,
  RefreshCw, Eye, Wand2, Clock, CheckCircle2, AlertCircle,
  Globe, Lock, Layers,
} from "lucide-react";
import { cn, scoreColor } from "@/lib/utils";

const DOC_META: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  feature_prd: { icon: FileText, label: "Feature Requirements Document", color: "text-blue-600" },
  impact_analysis: { icon: Map, label: "Impact Analysis", color: "text-cyan-600" },
  schema_changes: { icon: Database, label: "Schema & API Changes", color: "text-orange-600" },
  api_changes: { icon: Code2, label: "API Changes", color: "text-violet-600" },
  ui_changes: { icon: Palette, label: "UI Change Plan", color: "text-pink-600" },
  security_checklist: { icon: Shield, label: "Security Impact Checklist", color: "text-red-600" },
  implementation_tasks: { icon: GitBranch, label: "Implementation Tasks", color: "text-emerald-600" },
  test_plan: { icon: CheckSquare, label: "Test Plan", color: "text-amber-600" },
  deployment_plan: { icon: Rocket, label: "Deployment & Rollback Plan", color: "text-slate-600" },
};

const STATUS_CONFIG = {
  pending: { label: "Pending", icon: Clock, className: "bg-muted text-muted-foreground" },
  generating: { label: "Generating…", icon: Loader2, className: "bg-blue-100 text-blue-700" },
  ready: { label: "Ready", icon: CheckCircle2, className: "bg-emerald-100 text-emerald-700" },
  approved: { label: "Approved", icon: CheckCircle2, className: "bg-green-100 text-green-700" },
  needs_revision: { label: "Needs Revision", icon: AlertCircle, className: "bg-amber-100 text-amber-700" },
};

interface Props {
  request: FeatureRequest;
  documents: FeatureDocument[];
  tasks: FeatureTask[];
  repoConnection: RepoConnection | null;
}

export function FeaturePlanClient({ request, documents, tasks, repoConnection }: Props) {
  const router = useRouter();
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  const readyDocs = documents.filter((d) => d.status === "ready" || d.status === "approved").length;
  const progress = Math.round((readyDocs / 9) * 100);

  async function generateDoc(docType: string) {
    setGenerating((p) => ({ ...p, [docType]: true }));
    try {
      const res = await fetch("/api/feature/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featureRequestId: request.id, documentType: docType }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? "Generation failed");
      }
      toast.success("Document generated!");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setGenerating((p) => ({ ...p, [docType]: false }));
    }
  }

  async function generateAll() {
    const pending = documents.filter((d) => d.status === "pending").map((d) => d.type);
    if (!pending.length) { toast.info("All documents are already generated."); return; }
    toast.info(`Generating ${pending.length} documents…`);
    for (const type of pending) {
      await generateDoc(type);
    }
  }

  const stack = repoConnection?.detectedStack as Record<string, string> | null;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <Link href="/feature-planner">
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 mb-1">
              <ArrowLeft className="w-4 h-4" /> Feature Planner
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">{request.featureName}</h1>
          <p className="text-muted-foreground text-sm mt-0.5 max-w-2xl">{request.featureDescription}</p>
        </div>
        <Button onClick={generateAll} className="gap-2 shrink-0">
          <Wand2 className="w-4 h-4" />
          Generate All
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Documents</p>
            <p className={cn("text-3xl font-bold", scoreColor(progress))}>{readyDocs}/9</p>
            <Progress value={progress} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Scope</p>
            <p className="text-2xl font-bold text-foreground capitalize">{request.scopeLevel ?? "MVP"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Affected Roles</p>
            <p className="text-sm font-semibold text-foreground">{request.affectedRoles ?? "Not specified"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Flags</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {request.needsNewTables && <Badge variant="outline" className="text-xs">New Tables</Badge>}
              {request.needsNotifications && <Badge variant="outline" className="text-xs">Notifications</Badge>}
              {request.affectsPermissions && <Badge variant="outline" className="text-xs">Permissions</Badge>}
              {request.mobileRequired && <Badge variant="outline" className="text-xs">Mobile</Badge>}
              {request.affectsBilling && <Badge variant="outline" className="text-xs">Billing</Badge>}
              {!request.needsNewTables && !request.needsNotifications && !request.affectsPermissions && (
                <span className="text-xs text-muted-foreground">None</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid xl:grid-cols-3 gap-6">
        {/* Documents */}
        <div className="xl:col-span-2 space-y-3">
          <h2 className="text-base font-semibold text-foreground">Feature Documents</h2>
          {Object.entries(DOC_META).map(([type, meta]) => {
            const doc = documents.find((d) => d.type === type);
            const status = doc?.status ?? "pending";
            const statusCfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
            const StatusIcon = statusCfg.icon;
            const DocIcon = meta.icon;
            const isGenerating = generating[type];
            const isExpanded = expandedDoc === type;

            return (
              <Card key={type}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <DocIcon className={cn("w-4 h-4", meta.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                        <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded", statusCfg.className)}>
                          <StatusIcon className={cn("w-3 h-3", status === "generating" && "animate-spin")} />
                          {statusCfg.label}
                        </span>
                        {doc?.wordCount ? <span className="text-xs text-muted-foreground">{doc.wordCount.toLocaleString()} words</span> : null}
                      </div>

                      {/* Inline content preview */}
                      {doc?.content && isExpanded && (
                        <div className="mt-3 bg-muted/50 rounded-lg p-4 max-h-64 overflow-y-auto">
                          <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                            {doc.content.slice(0, 2000)}{doc.content.length > 2000 ? "\n\n…(truncated — copy for full content)" : ""}
                          </pre>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-2">
                        {doc?.content && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1.5 text-xs"
                            onClick={() => setExpandedDoc(isExpanded ? null : type)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {isExpanded ? "Collapse" : "Preview"}
                          </Button>
                        )}
                        {doc?.content && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1.5 text-xs"
                            onClick={() => { navigator.clipboard.writeText(doc.content ?? ""); toast.success("Copied!"); }}
                          >
                            Copy
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant={status === "pending" ? "default" : "outline"}
                          className="h-7 gap-1.5 text-xs ml-auto"
                          onClick={() => generateDoc(type)}
                          disabled={isGenerating || status === "generating"}
                        >
                          {isGenerating
                            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                            : <><RefreshCw className="w-3.5 h-3.5" /> {status === "pending" ? "Generate" : "Regenerate"}</>}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Right panel — Project info */}
        <div className="space-y-4">
          {repoConnection && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold">Connected Project</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-3">
                <div className="flex items-center gap-2 text-xs">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground truncate">{repoConnection.repoUrl}</span>
                </div>
                {repoConnection.branch && (
                  <div className="flex items-center gap-2 text-xs">
                    <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">{repoConnection.branch}</span>
                  </div>
                )}
                {stack && (
                  <div className="border-t border-border pt-3 space-y-1.5">
                    {Object.entries(stack)
                      .filter(([k, v]) => k !== "otherDeps" && v && v !== "Not detected")
                      .slice(0, 6)
                      .map(([k, v]) => (
                        <div key={k} className="flex justify-between text-xs">
                          <span className="text-muted-foreground capitalize">{k.replace(/([A-Z])/g, " $1").trim()}</span>
                          <span className="font-medium text-foreground">{v as string}</span>
                        </div>
                      ))}
                  </div>
                )}
                {repoConnection.projectSummary && (
                  <div className="border-t border-border pt-3">
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">{repoConnection.projectSummary}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold">Feature Flags</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="space-y-2 text-xs">
                {[
                  { label: "Affects Permissions", val: request.affectsPermissions },
                  { label: "Needs New Tables", val: request.needsNewTables },
                  { label: "Needs Notifications", val: request.needsNotifications },
                  { label: "Affects Dashboard", val: request.affectsDashboard },
                  { label: "Mobile Required", val: request.mobileRequired },
                  { label: "Affects Billing", val: request.affectsBilling },
                ].map(({ label, val }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={cn("font-medium", val ? "text-primary" : "text-muted-foreground")}>
                      {val ? "Yes" : "No"}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
