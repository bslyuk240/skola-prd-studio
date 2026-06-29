import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { securityScans } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Shield, ArrowRight, Clock, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { formatRelative, cn } from "@/lib/utils";
import { scoreLabel } from "@/lib/security-scanner";

const STATUS_CONFIG = {
  pending: { label: "Pending", icon: Clock, className: "text-muted-foreground" },
  scanning: { label: "Scanning", icon: Loader2, className: "text-blue-600" },
  analyzed: { label: "Analyzed", icon: CheckCircle2, className: "text-emerald-600" },
  generating_prd: { label: "Generating PRD", icon: Loader2, className: "text-blue-600" },
  complete: { label: "Complete", icon: CheckCircle2, className: "text-emerald-600" },
  error: { label: "Error", icon: XCircle, className: "text-red-600" },
};

export default async function SecurityFixPlannerPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const scans = await db
    .select()
    .from(securityScans)
    .where(eq(securityScans.userId, userId))
    .orderBy(desc(securityScans.createdAt))
    .limit(20);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Security Fix Planner</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Scan an existing project, classify security gaps by confidence level, and generate a remediation plan.
          </p>
        </div>
        <Link href="/security-fix-planner/new">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            New Security Scan
          </Button>
        </Link>
      </div>

      {scans.length === 0 && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { step: 1, title: "Connect Project", desc: "GitHub URL or paste your project structure" },
              { step: 2, title: "Deep Scan", desc: "We read key files, detect patterns, apply 10 security packs" },
              { step: 3, title: "Classify Findings", desc: "Confirmed issues, likely gaps, and manual review items" },
              { step: 4, title: "Security Fix PRD", desc: "Ready-to-use document + AI agent prompt for implementation" },
            ].map(({ step, title, desc }) => (
              <div key={step} className="bg-card border border-border rounded-lg p-4">
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center mb-3">{step}</div>
                <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {scans.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl p-16 text-center">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mx-auto mb-4">
            <Shield className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground mb-2">No scans yet</h3>
          <p className="text-muted-foreground text-sm mb-4 max-w-xs mx-auto">
            Run your first security scan to get a prioritised list of gaps and a Security Fix PRD.
          </p>
          <Link href="/security-fix-planner/new">
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" /> Start a Scan
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {scans.map((scan) => {
            const status = scan.status ?? "pending";
            const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            const score = scan.safeToShipScore;
            const scoreMeta = score !== null ? scoreLabel(score) : null;

            return (
              <Card key={scan.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="flex flex-col items-center">
                        {score !== null ? (
                          <>
                            <span className={cn("text-2xl font-bold", scoreMeta?.color)}>{score}</span>
                            <span className="text-xs text-muted-foreground">/100</span>
                          </>
                        ) : (
                          <Icon className={cn("w-5 h-5", cfg.className, status.includes("ing") && "animate-spin")} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{scan.repoUrl ?? "Manual scan"}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className={cn("flex items-center gap-1", cfg.className)}>
                            <Icon className={cn("w-3 h-3", status.includes("ing") && "animate-spin")} />
                            {cfg.label}
                          </span>
                          {scan.confirmedCount !== null && (
                            <>
                              {(scan.confirmedCount ?? 0) > 0 && <span className="text-red-600 font-medium">{scan.confirmedCount} confirmed</span>}
                              {(scan.likelyGapCount ?? 0) > 0 && <span className="text-amber-600">{scan.likelyGapCount} likely gaps</span>}
                              {(scan.needsReviewCount ?? 0) > 0 && <span className="text-blue-600">{scan.needsReviewCount} to review</span>}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground">{formatRelative(scan.createdAt)}</span>
                      {scan.status === "complete" && (
                        <Link href={`/security-fix-planner/${scan.id}`}>
                          <Button size="sm" variant="outline" className="gap-1">
                            View Report <ArrowRight className="w-3 h-3" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
