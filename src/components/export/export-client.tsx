"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { Project } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Download, FileText, Code2, FileCode,
  CheckCircle2, Clock, Loader2, Shield, GitBranch,
  Database, Map, Palette, Layers, ExternalLink,
} from "lucide-react";
import { cn, scoreColor } from "@/lib/utils";

const DOC_META = [
  { key: "prd", icon: FileText, label: "Product Requirements Document", color: "text-blue-600", bg: "bg-blue-50" },
  { key: "trd", icon: Code2, label: "Technical Requirements Document", color: "text-violet-600", bg: "bg-violet-50" },
  { key: "app_flow", icon: Map, label: "App Flow", color: "text-cyan-600", bg: "bg-cyan-50" },
  { key: "ux_brief", icon: Palette, label: "UI/UX Design Brief", color: "text-pink-600", bg: "bg-pink-50" },
  { key: "backend_schema", icon: Database, label: "Backend Schema", color: "text-orange-600", bg: "bg-orange-50" },
  { key: "implementation_plan", icon: GitBranch, label: "Implementation Plan", color: "text-emerald-600", bg: "bg-emerald-50" },
  { key: "security_blueprint", icon: Shield, label: "Security Blueprint", color: "text-red-600", bg: "bg-red-50" },
];

const EXPORT_OPTIONS = [
  {
    id: "html",
    icon: FileCode,
    label: "Styled HTML Bundle",
    description: "Self-contained HTML file with all 7 documents, rendered Mermaid diagrams (flowcharts, ERDs, Gantt), colour-coded tables, and a Print → Save PDF button. Best for sharing and archiving.",
    badge: "Recommended",
    badgeClass: "bg-primary/10 text-primary border-primary/30",
    format: "html",
    ext: ".html",
    note: "Open in any browser · Print to PDF · All diagrams rendered",
  },
  {
    id: "markdown",
    icon: FileText,
    label: "Markdown Bundle",
    description: "All 7 documents in a single .md file. Mermaid diagram definitions included as code blocks — they render in GitHub, GitLab, Notion, Obsidian, and VS Code (with Mermaid extension).",
    badge: "Universal",
    badgeClass: "bg-muted text-muted-foreground border-border",
    format: "markdown",
    ext: ".md",
    note: "Paste into Cursor / Claude Code / any AI agent as context",
  },
];

interface Props {
  project: Project;
  totalDocs: number;
  readyDocs: number;
  totalTasks: number;
  doneTasks: number;
}

export function ExportClient({ project, totalDocs, readyDocs, totalTasks, doneTasks }: Props) {
  const [downloading, setDownloading] = useState<string | null>(null);

  async function download(format: string, ext: string) {
    setDownloading(format);
    try {
      const res = await fetch(`/api/projects/${project.id}/export?format=${format}`);
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      a.download = `${slug}-blueprint${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${ext.toUpperCase().slice(1)} export downloaded!`);
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setDownloading(null);
    }
  }

  const readinessScore = Math.round((readyDocs / 7) * 100);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href={`/projects/${project.id}/documents`}>
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 mb-1">
              <ArrowLeft className="w-4 h-4" /> Documents
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Export Blueprint</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{project.name}</p>
        </div>
      </div>

      {/* Readiness summary */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <Card className={cn(readyDocs < 7 ? "border-amber-200 bg-amber-50/30" : "border-emerald-200 bg-emerald-50/30")}>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              {readyDocs === 7
                ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                : <Clock className="w-4 h-4 text-amber-500" />}
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Documents</span>
            </div>
            <p className={cn("text-3xl font-bold", readyDocs === 7 ? "text-emerald-600" : "text-amber-500")}>
              {readyDocs}/7
            </p>
            <Progress value={readinessScore} className="h-1.5 mt-2" />
            <p className="text-xs text-muted-foreground mt-1.5">
              {readyDocs === 7 ? "All ready to export" : `${7 - readyDocs} still pending`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Blueprint Readiness</p>
            <p className={cn("text-3xl font-bold", scoreColor(project.readinessScore ?? 0))}>
              {project.readinessScore ?? 0}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Security Score</p>
            <p className={cn("text-3xl font-bold", scoreColor(project.securityScore ?? 0))}>
              {project.securityScore ?? 0}/100
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Build Tasks</p>
            <p className="text-3xl font-bold text-foreground">{totalTasks}</p>
            <p className="text-xs text-muted-foreground mt-1">{doneTasks} done</p>
          </CardContent>
        </Card>
      </div>

      {readyDocs < 7 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8">
          <Clock className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {7 - readyDocs} document{7 - readyDocs > 1 ? "s" : ""} not yet generated
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              You can still export now — pending documents will show a placeholder. Go to{" "}
              <Link href={`/projects/${project.id}/documents`} className="underline font-medium">Documents</Link>{" "}
              to generate the missing ones first.
            </p>
          </div>
        </div>
      )}

      <div className="grid xl:grid-cols-2 gap-6 mb-8">
        {EXPORT_OPTIONS.map(({ id, icon: Icon, label, description, badge, badgeClass, format, ext, note }) => (
          <Card key={id} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <CardTitle className="text-base font-bold">{label}</CardTitle>
                    <Badge variant="outline" className={cn("text-xs", badgeClass)}>{badge}</Badge>
                  </div>
                  <CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-5 px-5 flex flex-col flex-1 justify-end">
              <div className="bg-muted/50 rounded-lg px-4 py-2.5 text-xs text-muted-foreground mb-4 flex items-center gap-2">
                <span className="font-mono text-foreground font-medium">{ext}</span>
                <span>·</span>
                <span>{note}</span>
              </div>
              <Button
                onClick={() => download(format, ext)}
                disabled={downloading !== null}
                className="w-full gap-2"
                variant={id === "html" ? "default" : "outline"}
              >
                {downloading === format
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                  : <><Download className="w-4 h-4" /> Download {ext}</>}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* What's included */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">What&apos;s included in the export</CardTitle>
          <CardDescription className="text-xs">Both formats contain all of the following.</CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
            {DOC_META.map(({ key, icon: Icon, label, color, bg }) => (
              <div key={key} className="flex items-center gap-2.5 bg-muted/40 rounded-lg px-3 py-2.5">
                <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0", bg)}>
                  <Icon className={cn("w-3.5 h-3.5", color)} />
                </div>
                <span className="text-xs font-medium text-foreground leading-tight">{label}</span>
              </div>
            ))}
            <div className="flex items-center gap-2.5 bg-muted/40 rounded-lg px-3 py-2.5">
              <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                <Layers className="w-3.5 h-3.5 text-slate-600" />
              </div>
              <span className="text-xs font-medium text-foreground leading-tight">Build Task Roadmap</span>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Diagrams included (HTML renders, Markdown as code)</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "System Architecture", doc: "TRD", type: "graph TD" },
                { label: "User Flow Diagram", doc: "App Flow", type: "flowchart TD" },
                { label: "Navigation Structure", doc: "UI/UX", type: "graph TD" },
                { label: "Entity Relationship Diagram", doc: "Backend Schema", type: "erDiagram" },
                { label: "Implementation Gantt", doc: "Impl. Plan", type: "gantt" },
                { label: "Threat Model", doc: "Security", type: "flowchart TD" },
              ].map(({ label, doc, type }) => (
                <div key={label} className="flex items-start gap-2 bg-muted/30 rounded-lg p-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{doc} · Mermaid {type}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
