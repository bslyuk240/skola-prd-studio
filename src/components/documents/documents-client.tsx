"use client";

import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Project, Document } from "@/db/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  FileText, Shield, Database, GitBranch, Map, Palette,
  Loader2, RefreshCw, Eye, CheckCircle2, Clock, AlertCircle, Wand2, Download
} from "lucide-react";
import { cn, scoreColor } from "@/lib/utils";
import { isEieEnabledForProject } from "@/lib/eie/project-settings";
import { ProjectEieSettings } from "@/components/eie/project-eie-settings";

const DOC_META: Record<string, { icon: React.ElementType; label: string; color: string; description: string }> = {
  prd: { icon: FileText, label: "PRD", color: "text-blue-600", description: "Product Requirements Document" },
  trd: { icon: FileText, label: "TRD", color: "text-violet-600", description: "Technical Requirements Document" },
  app_flow: { icon: Map, label: "App Flow", color: "text-cyan-600", description: "User journeys and screen flows" },
  ux_brief: { icon: Palette, label: "UI/UX Brief", color: "text-pink-600", description: "Design direction and component guidelines" },
  backend_schema: { icon: Database, label: "Backend Schema", color: "text-orange-600", description: "Database tables, relationships, API endpoints" },
  implementation_plan: { icon: GitBranch, label: "Implementation Plan", color: "text-emerald-600", description: "Build phases and task breakdown" },
  security_blueprint: { icon: Shield, label: "Security Blueprint", color: "text-red-600", description: "Security controls and checklist" },
};

const STATUS_CONFIG = {
  pending: { label: "Pending", icon: Clock, className: "bg-muted text-muted-foreground" },
  generating: { label: "Generating…", icon: Loader2, className: "bg-blue-100 text-blue-700" },
  ready: { label: "Ready", icon: CheckCircle2, className: "bg-emerald-100 text-emerald-700" },
  approved: { label: "Approved", icon: CheckCircle2, className: "bg-green-100 text-green-700" },
  needs_revision: { label: "Needs Revision", icon: AlertCircle, className: "bg-amber-100 text-amber-700" },
};

interface Props {
  project: Project;
  documents: Document[];
}

export function DocumentsClient({ project, documents }: Props) {
  const router = useRouter();
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [eiePhase, setEiePhase] = useState<Record<string, boolean>>({});
  const eieEnabled = isEieEnabledForProject(project);

  const ready = documents.filter((d) => d.status === "ready" || d.status === "approved").length;
  const readinessScore = Math.round((ready / 7) * 100);

  async function pollDocStatus(docType: string): Promise<"ready" | "pending" | "timeout"> {
    for (let i = 0; i < 80; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const res = await fetch(`/api/generate/status?projectId=${project.id}&documentType=${docType}`);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.status === "ready") return "ready";
      if (data.status === "pending") return "pending";
    }
    return "timeout";
  }

  async function generateDoc(docType: string) {
    setGenerating((p) => ({ ...p, [docType]: true }));
    if (eieEnabled) {
      setEiePhase((p) => ({ ...p, [docType]: true }));
      setTimeout(() => {
        setEiePhase((p) => ({ ...p, [docType]: false }));
      }, 4000);
    }
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, documentType: docType }),
      });
      if (!res.ok) throw new Error();

      if (res.status === 202) {
        const result = await pollDocStatus(docType);
        if (result === "pending") throw new Error();
        if (result === "timeout") {
          toast.error("Still generating — check back in a moment.");
          return;
        }
      }

      toast.success("Document generated successfully!");
      router.refresh();
    } catch {
      toast.error("Generation failed. Check your OpenRouter API key.");
    } finally {
      setGenerating((p) => ({ ...p, [docType]: false }));
      setEiePhase((p) => ({ ...p, [docType]: false }));
    }
  }

  async function generateAll() {
    const pending = documents.filter((d) => d.status === "pending").map((d) => d.type);
    if (pending.length === 0) return toast.info("All documents are already generated.");
    toast.info(`Generating ${pending.length} documents…`);
    await Promise.all(pending.map((type) => generateDoc(type)));
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/dashboard" className="text-muted-foreground text-sm hover:text-foreground">Dashboard</Link>
            <span className="text-muted-foreground text-sm">/</span>
            <span className="text-sm font-medium text-foreground truncate max-w-48">{project.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{project.description}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/projects/${project.id}/export`}>
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </Link>
          <Button onClick={generateAll} className="gap-2">
            <Wand2 className="w-4 h-4" />
            Generate All
          </Button>
        </div>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Blueprint Readiness</p>
            <p className={cn("text-3xl font-bold mb-2", scoreColor(readinessScore))}>{readinessScore}%</p>
            <Progress value={readinessScore} className="h-1.5" />
            <p className="text-xs text-muted-foreground mt-1.5">{ready} of 7 documents ready</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Security Score</p>
            <p className={cn("text-3xl font-bold mb-2", scoreColor(project.securityScore ?? 0))}>
              {project.securityScore ?? 0}/100
            </p>
            <Progress value={project.securityScore ?? 0} className="h-1.5" />
            <p className="text-xs text-muted-foreground mt-1.5">
              {(project.securityScore ?? 0) < 60 ? "Needs Review" : "Good"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Stack</p>
            <div className="space-y-1 mt-1">
              {Object.entries((project.stackPreferences as Record<string, string>) ?? {})
                .filter(([, v]) => v && v !== "None")
                .slice(0, 4)
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-muted-foreground capitalize">{k}</span>
                    <span className="font-medium text-foreground">{v}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* EIE settings */}
      <div className="mb-8">
        <ProjectEieSettings project={project} />
      </div>

      {/* Document cards */}
      <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {Object.entries(DOC_META).map(([type, meta]) => {
          const doc = documents.find((d) => d.type === type);
          const status = doc?.status ?? "pending";
          const statusCfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
          const StatusIcon = statusCfg.icon;
          const isGenerating = generating[type];
          const showEieStep = eieEnabled && (eiePhase[type] || isGenerating);
          const DocIcon = meta.icon;

          return (
            <Card key={type} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start gap-3 flex-1 min-w-0 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <DocIcon className={cn("w-4 h-4", meta.color)} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground text-sm mb-1">{meta.description}</h3>
                    <div className="flex items-center gap-1.5">
                      <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full", statusCfg.className)}>
                        <StatusIcon className={cn("w-3 h-3", status === "generating" && "animate-spin")} />
                        {statusCfg.label}
                      </span>
                      {doc?.wordCount ? (
                        <span className="text-xs text-muted-foreground">{doc.wordCount.toLocaleString()} words</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {status !== "pending" && doc?.id && (
                    <Link href={`/projects/${project.id}/documents/${doc.id}`}>
                      <Button size="sm" variant="outline" className="gap-1.5">
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </Button>
                    </Link>
                  )}
                  <Button
                    size="sm"
                    variant={status === "pending" ? "default" : "ghost"}
                    className="gap-1.5"
                    onClick={() => generateDoc(type)}
                    disabled={isGenerating || status === "generating"}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {showEieStep && eiePhase[type]
                          ? "Querying engineering knowledge…"
                          : "Generating…"}
                      </>
                    ) : (
                      <><RefreshCw className="w-3.5 h-3.5" /> {status === "pending" ? "Generate" : "Regenerate"}</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
