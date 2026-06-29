import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects, documents, featureRequests, featureDocuments, securityScans } from "@/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft, Zap, FileText, Shield, GitBranch } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, scoreColor } from "@/lib/utils";
import { CREDIT_LIMIT } from "@/lib/credits";

export default async function UsagePage() {
  const { userId } = await auth();
  if (!userId) return null;

  // Fetch user's projects and their docs
  const userProjects = await db.select().from(projects).where(eq(projects.userId, userId));
  const projectIds = userProjects.map((p) => p.id);

  // Blueprint docs with credits
  const allDocs = projectIds.length
    ? await db
        .select()
        .from(documents)
        .where(inArray(documents.projectId, projectIds))
        .orderBy(desc(documents.updatedAt))
    : [];

  // Feature requests + docs
  const userRequests = await db.select().from(featureRequests).where(eq(featureRequests.userId, userId));
  const requestIds = userRequests.map((r) => r.id);

  const allFeatureDocs = requestIds.length
    ? await db
        .select()
        .from(featureDocuments)
        .where(inArray(featureDocuments.featureRequestId, requestIds))
        .orderBy(desc(featureDocuments.updatedAt))
    : [];

  // Security scans
  const allScans = await db
    .select()
    .from(securityScans)
    .where(eq(securityScans.userId, userId))
    .orderBy(desc(securityScans.createdAt));

  // Totals
  const blueprintCredits = allDocs.reduce((s, d) => s + (d.aiCreditsUsed ?? 0), 0);
  const featureCredits = allFeatureDocs.reduce((s, d) => s + (d.aiCreditsUsed ?? 0), 0);
  const securityCredits = allScans.reduce((s, s2) => s + (s2.aiCreditsUsed ?? 0), 0);
  const totalConsumed = blueprintCredits + featureCredits + securityCredits;
  const percentage = Math.min(100, Math.round((totalConsumed / CREDIT_LIMIT) * 100));
  const remaining = Math.max(0, CREDIT_LIMIT - totalConsumed);

  const isWarning = percentage >= 70;
  const isCritical = percentage >= 90;

  // Blueprint docs that actually consumed credits
  const usedBlueprintDocs = allDocs.filter((d) => (d.aiCreditsUsed ?? 0) > 0);
  const usedFeatureDocs = allFeatureDocs.filter((d) => (d.aiCreditsUsed ?? 0) > 0);
  const usedScans = allScans.filter((s) => (s.aiCreditsUsed ?? 0) > 0);

  // Lookup maps
  const projectMap = Object.fromEntries(userProjects.map((p) => [p.id, p.name]));
  const requestMap = Object.fromEntries(userRequests.map((r) => [r.id, r.featureName]));

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

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 mb-1">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-foreground">AI Credit Usage</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Track your AI generation consumption across all features.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className={cn("lg:col-span-2", isCritical && "border-red-200")}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Consumed</span>
              <Zap className={cn("w-4 h-4", isCritical ? "text-red-500" : isWarning ? "text-amber-500" : "text-muted-foreground")} />
            </div>
            <div className="flex items-end gap-2 mb-2">
              <p className={cn("text-3xl font-bold", isCritical ? "text-red-600" : isWarning ? "text-amber-500" : "text-foreground")}>
                {totalConsumed.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground mb-1">/ {CREDIT_LIMIT.toLocaleString()}</p>
            </div>
            <Progress value={percentage} className={cn("h-2 mb-2", isCritical ? "[&>div]:bg-red-500" : isWarning ? "[&>div]:bg-amber-500" : "")} />
            <p className="text-xs text-muted-foreground">{remaining} credits remaining</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Blueprint Docs</span>
              <FileText className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold text-foreground">{blueprintCredits}</p>
            <p className="text-xs text-muted-foreground mt-1">{usedBlueprintDocs.length} generations</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Feature Docs</span>
              <GitBranch className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold text-foreground">{featureCredits}</p>
            <p className="text-xs text-muted-foreground mt-1">{usedFeatureDocs.length} generations</p>
          </CardContent>
        </Card>
      </div>

      {/* Security scans row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Security Scans</span>
              <Shield className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold text-foreground">{securityCredits}</p>
            <p className="text-xs text-muted-foreground mt-1">{usedScans.length} scans run</p>
          </CardContent>
        </Card>

        {/* Breakdown bar */}
        <Card className="col-span-2">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">Usage Breakdown</p>
            {totalConsumed === 0 ? (
              <p className="text-sm text-muted-foreground">No credits consumed yet. Generate documents or run a security scan to see usage here.</p>
            ) : (
              <div className="space-y-3">
                {[
                  { label: "Blueprint Documents", value: blueprintCredits, color: "bg-blue-500" },
                  { label: "Feature Documents", value: featureCredits, color: "bg-emerald-500" },
                  { label: "Security Scans", value: securityCredits, color: "bg-red-500" },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium text-foreground">{value} credits</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", color)}
                        style={{ width: totalConsumed > 0 ? `${Math.round((value / totalConsumed) * 100)}%` : "0%" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Blueprint doc log */}
      {usedBlueprintDocs.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" /> Blueprint Document Generations
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="space-y-2">
              {usedBlueprintDocs.slice(0, 20).map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">{DOC_LABELS[doc.type] ?? doc.type}</Badge>
                    <span className="text-sm text-muted-foreground truncate max-w-xs">{projectMap[doc.projectId] ?? "Project"}</span>
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
      {usedFeatureDocs.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-emerald-600" /> Feature Document Generations
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="space-y-2">
              {usedFeatureDocs.slice(0, 20).map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">{FEAT_LABELS[doc.type] ?? doc.type}</Badge>
                    <span className="text-sm text-muted-foreground truncate max-w-xs">{requestMap[doc.featureRequestId] ?? "Feature"}</span>
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
      {usedScans.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-600" /> Security Scans
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="space-y-2">
              {usedScans.map((scan) => (
                <div key={scan.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs capitalize">{scan.provider}</Badge>
                    <span className="text-sm text-muted-foreground truncate max-w-xs">
                      {scan.repoName ? `${scan.repoOwner}/${scan.repoName}` : "Manual context scan"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {scan.safeToShipScore != null && (
                      <span className={cn("text-xs font-medium", scoreColor(scan.safeToShipScore))}>
                        {scan.safeToShipScore}/100
                      </span>
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
