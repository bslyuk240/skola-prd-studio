"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Document } from "@/db/schema";
import type { ValidationIssue } from "@/lib/zod/blueprint-schemas";
import type { IntegrityReport } from "@/lib/blueprint-engine/integrity-report";
import type { CategoryValidationState } from "@/lib/blueprint-engine/validate/validation-lifecycle";
import {
  INTEGRITY_CATEGORIES,
  issueAcceptable,
  formatIssueCategory,
} from "@/lib/blueprint-engine/integrity-report";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { cn, scoreColor } from "@/lib/utils";
import { PROJECT_DOCUMENT_TITLES_BY_TYPE, type ProjectDocumentType } from "@/lib/project-document-types";

const PROJECT_MODEL_GROUP_KEY = "__project_model__";

type Props = {
  projectId: string;
  report: IntegrityReport;
  documents: Document[];
  onRegenerateDocument?: (documentType: string) => Promise<void> | void;
  onFixDocument?: (documentType: string | null) => Promise<void> | void;
};

function formatDocumentType(documentType: string): string {
  return documentType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function groupLabel(groupKey: string): string {
  if (groupKey === PROJECT_MODEL_GROUP_KEY) return "Project Model";
  return PROJECT_DOCUMENT_TITLES_BY_TYPE[groupKey as ProjectDocumentType] ?? formatDocumentType(groupKey);
}

function statusIcon(status: IntegrityReport["status"]) {
  if (status === "pass") {
    return <CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden />;
  }
  return <AlertTriangle className="w-5 h-5 text-amber-500" aria-hidden />;
}

function statusLabel(status: IntegrityReport["status"], errorCount: number) {
  if (status === "pass") return "All checks passed";
  if (status === "fail") return `${errorCount} blocking ${errorCount === 1 ? "issue" : "issues"}`;
  return "Review recommended";
}

function severityBadge(issue: ValidationIssue) {
  if (issue.severity === "error") {
    return (
      <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
        Error
      </Badge>
    );
  }
  if (issue.severity === "warning") {
    return (
      <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
        Warning
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {issue.severity}
    </Badge>
  );
}

function categoryStateBadge(state: CategoryValidationState) {
  if (state === "pending") {
    return (
      <Badge variant="outline" className="text-muted-foreground border-border">
        Pending
      </Badge>
    );
  }
  if (state === "fail") {
    return (
      <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
        Fail
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
      Pass
    </Badge>
  );
}

function categoryScoreLabel(
  score: number | null,
  state: CategoryValidationState
): string {
  if (state === "pending") return "Pending validation";
  if (score == null) return "Pending validation";
  return `${score}%`;
}

export function BlueprintIntegrityReport({
  projectId,
  report,
  documents,
  onRegenerateDocument,
  onFixDocument,
}: Props) {
  const router = useRouter();
  const [selectedIssue, setSelectedIssue] = useState<ValidationIssue | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [regeneratingDocs, setRegeneratingDocs] = useState<Record<string, boolean>>({});
  const [fixingGroup, setFixingGroup] = useState<Record<string, boolean>>({});

  const sortedIssues = [...report.issues].sort((a, b) => {
    const rank = { error: 0, warning: 1, assumption: 2, recommendation: 3 };
    return (rank[a.severity as keyof typeof rank] ?? 4) - (rank[b.severity as keyof typeof rank] ?? 4);
  });

  const groupedIssues = new Map<string, ValidationIssue[]>();
  for (const issue of sortedIssues) {
    const key = issue.documentTypes[0] ?? PROJECT_MODEL_GROUP_KEY;
    const group = groupedIssues.get(key);
    if (group) {
      group.push(issue);
    } else {
      groupedIssues.set(key, [issue]);
    }
  }

  const editDocId = selectedIssue?.documentTypes[0]
    ? documents.find((doc) => doc.type === selectedIssue.documentTypes[0])?.id
    : undefined;

  async function acceptResolution(optionId: string) {
    if (!selectedIssue) return;
    setAccepting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/integrity-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId: selectedIssue.id, optionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Could not apply resolution");
      }
      toast.success("Canonical model updated");
      setSelectedIssue(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not apply resolution");
    } finally {
      setAccepting(false);
    }
  }

  async function regenerateDocument(documentType: string) {
    if (!onRegenerateDocument) return;
    setRegeneratingDocs((p) => ({ ...p, [documentType]: true }));
    try {
      await onRegenerateDocument(documentType);
      setSelectedIssue(null);
    } finally {
      setRegeneratingDocs((p) => ({ ...p, [documentType]: false }));
    }
  }

  async function fixGroup(groupKey: string) {
    if (!onFixDocument) return;
    setFixingGroup((p) => ({ ...p, [groupKey]: true }));
    try {
      await onFixDocument(groupKey === PROJECT_MODEL_GROUP_KEY ? null : groupKey);
    } finally {
      setFixingGroup((p) => ({ ...p, [groupKey]: false }));
    }
  }

  return (
    <>
      <Card className="mb-8">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {statusIcon(report.status)}
                <h2 className="text-base font-semibold text-foreground">Blueprint Integrity</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                {statusLabel(report.status, report.errorCount)}
                {report.hasBlockingErrors
                  ? " — export is blocked until errors are resolved"
                  : report.warningCount > 0
                    ? " — review warnings before sharing"
                    : ""}
              </p>
            </div>
            <div className="text-right shrink-0">
              {report.breakdown.overall == null ? (
                <>
                  <p className="text-sm font-semibold text-muted-foreground">Generation in progress</p>
                  <p className="text-xs text-muted-foreground">Overall readiness</p>
                </>
              ) : (
                <>
                  <p className={cn("text-3xl font-bold", scoreColor(report.breakdown.overall))}>
                    {report.breakdown.overall}%
                  </p>
                  <p className="text-xs text-muted-foreground">Overall readiness</p>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
            {INTEGRITY_CATEGORIES.map(({ key, label, breakdownKey }) => {
              const score = report.breakdown[breakdownKey];
              const state = report.breakdown.categoryStates[breakdownKey];
              return (
                <div key={key} className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    {categoryStateBadge(state)}
                  </div>
                  <p className={cn("text-sm font-semibold", scoreColor(score))}>
                    {categoryScoreLabel(score, state)}
                  </p>
                  {score != null ? <Progress value={score} className="h-1 mt-2" /> : null}
                </div>
              );
            })}
          </div>

          {sortedIssues.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-800">
                No consistency, terminology, or workflow conflicts detected across generated documents.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Issues ({report.errorCount} errors, {report.warningCount} warnings)
              </p>
              {[...groupedIssues.entries()].map(([groupKey, groupIssues]) => {
                const fixableInGroup = groupIssues.filter(
                  (issue) => issue.severity === "error" && (issue.resolutionOptions?.length ?? 0) > 0
                );
                return (
                  <div key={groupKey} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground">
                        {groupLabel(groupKey)}{" "}
                        <span className="font-normal text-muted-foreground">({groupIssues.length})</span>
                      </p>
                      {onFixDocument && fixableInGroup.length > 0 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => fixGroup(groupKey)}
                          disabled={fixingGroup[groupKey]}
                        >
                          {fixingGroup[groupKey] ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Fixing…
                            </>
                          ) : (
                            <>
                              <Wrench className="w-3.5 h-3.5" />
                              Fix all {fixableInGroup.length}
                            </>
                          )}
                        </Button>
                      ) : null}
                    </div>
                    {groupIssues.map((issue) => (
                      <button
                        key={issue.id}
                        type="button"
                        onClick={() => setSelectedIssue(issue)}
                        className="w-full flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-left hover:bg-muted/40 transition-colors"
                      >
                        <ShieldAlert
                          className={cn(
                            "w-4 h-4 mt-0.5 shrink-0",
                            issue.severity === "error" ? "text-red-600" : "text-amber-500"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {severityBadge(issue)}
                            <span className="text-xs text-muted-foreground">
                              {formatIssueCategory(issue.category)}
                            </span>
                          </div>
                          <p className="text-sm text-foreground line-clamp-2">{issue.message}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={selectedIssue !== null} onOpenChange={(open) => !open && setSelectedIssue(null)}>
        <DialogContent className="sm:max-w-lg">
          {selectedIssue ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-base font-semibold">Resolve conflict</DialogTitle>
                <DialogDescription className="text-sm">
                  {formatIssueCategory(selectedIssue.category)}
                  {selectedIssue.documentTypes.length > 0
                    ? ` · ${selectedIssue.documentTypes.join(", ")}`
                    : ""}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Conflict</p>
                  <p className="text-sm text-foreground">{selectedIssue.message}</p>
                </div>
                {selectedIssue.resolution && (selectedIssue.resolutionOptions?.length ?? 0) <= 1 ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Suggested resolution</p>
                    <p className="text-sm text-foreground">{selectedIssue.resolution}</p>
                  </div>
                ) : null}
                {(selectedIssue.resolutionOptions?.length ?? 0) > 1 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Choose a fix</p>
                    {selectedIssue.resolutionOptions!.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => acceptResolution(option.id)}
                        disabled={accepting}
                        className="w-full flex flex-col items-start gap-0.5 rounded-lg border border-border bg-card p-3 text-left hover:bg-muted/40 transition-colors disabled:opacity-60"
                      >
                        <span className="text-sm font-medium text-foreground">{option.label}</span>
                        {option.description ? (
                          <span className="text-xs text-muted-foreground">{option.description}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}
                {!issueAcceptable(selectedIssue) &&
                onRegenerateDocument &&
                selectedIssue.documentTypes.length > 1 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      This spans multiple documents — regenerate whichever one is actually wrong
                    </p>
                    {selectedIssue.documentTypes.map((docType) => (
                      <button
                        key={docType}
                        type="button"
                        onClick={() => regenerateDocument(docType)}
                        disabled={regeneratingDocs[docType]}
                        className="w-full flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-left hover:bg-muted/40 transition-colors disabled:opacity-60"
                      >
                        <span className="text-sm font-medium text-foreground">{formatDocumentType(docType)}</span>
                        {regeneratingDocs[docType] ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                {editDocId ? (
                  <Link href={`/projects/${projectId}/documents/${editDocId}`}>
                    <Button variant="outline" size="sm">
                      Edit document
                    </Button>
                  </Link>
                ) : null}
                {selectedIssue.resolutionOptions?.length === 1 ? (
                  <Button
                    size="sm"
                    onClick={() => acceptResolution(selectedIssue.resolutionOptions![0].id)}
                    disabled={accepting}
                  >
                    {accepting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Applying…
                      </>
                    ) : (
                      "Accept resolution"
                    )}
                  </Button>
                ) : !issueAcceptable(selectedIssue) &&
                  onRegenerateDocument &&
                  selectedIssue.documentTypes.length === 1 ? (
                  <Button
                    size="sm"
                    onClick={() => regenerateDocument(selectedIssue.documentTypes[0])}
                    disabled={regeneratingDocs[selectedIssue.documentTypes[0]]}
                  >
                    {regeneratingDocs[selectedIssue.documentTypes[0]] ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Regenerating…
                      </>
                    ) : (
                      `Regenerate ${formatDocumentType(selectedIssue.documentTypes[0])}`
                    )}
                  </Button>
                ) : !issueAcceptable(selectedIssue) &&
                  (selectedIssue.resolutionOptions?.length ?? 0) === 0 &&
                  !(onRegenerateDocument && selectedIssue.documentTypes.length > 1) ? (
                  <Button size="sm" variant="outline" onClick={() => setSelectedIssue(null)}>
                    Close
                  </Button>
                ) : null}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
