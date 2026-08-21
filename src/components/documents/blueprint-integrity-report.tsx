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
  ShieldAlert,
} from "lucide-react";
import { cn, scoreColor } from "@/lib/utils";

type Props = {
  projectId: string;
  report: IntegrityReport;
  documents: Document[];
};

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

export function BlueprintIntegrityReport({ projectId, report, documents }: Props) {
  const router = useRouter();
  const [selectedIssue, setSelectedIssue] = useState<ValidationIssue | null>(null);
  const [accepting, setAccepting] = useState(false);

  const sortedIssues = [...report.issues].sort((a, b) => {
    const rank = { error: 0, warning: 1, assumption: 2, recommendation: 3 };
    return (rank[a.severity as keyof typeof rank] ?? 4) - (rank[b.severity as keyof typeof rank] ?? 4);
  });

  const editDocId = selectedIssue?.documentTypes[0]
    ? documents.find((doc) => doc.type === selectedIssue.documentTypes[0])?.id
    : undefined;

  async function acceptResolution() {
    if (!selectedIssue) return;
    setAccepting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/integrity-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId: selectedIssue.id }),
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
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Issues ({report.errorCount} errors, {report.warningCount} warnings)
              </p>
              {sortedIssues.map((issue) => (
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
                {selectedIssue.resolution ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Suggested resolution</p>
                    <p className="text-sm text-foreground">{selectedIssue.resolution}</p>
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
                {issueAcceptable(selectedIssue) ? (
                  <Button size="sm" onClick={acceptResolution} disabled={accepting}>
                    {accepting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Applying…
                      </>
                    ) : (
                      "Accept resolution"
                    )}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setSelectedIssue(null)}>
                    Close
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
