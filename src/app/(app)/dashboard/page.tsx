import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import {
  Plus,
  FileText,
  Shield,
  CheckSquare,
  Bot,
  ArrowRight,
  TrendingUp,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatRelative, scoreColor, scoreLabel } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { CreditUsageWidget } from "@/components/dashboard/credit-usage-widget";

const DOC_LABELS: Record<string, string> = {
  prd: "PRD",
  trd: "TRD",
  app_flow: "App Flow",
  ux_brief: "UI/UX Brief",
  backend_schema: "Backend Schema",
  implementation_plan: "Implementation Plan",
  security_blueprint: "Security Blueprint",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  generating: "bg-blue-100 text-blue-700",
  review: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  building: "bg-blue-100 text-blue-700",
};

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) return null;

  let userProjects: typeof projects.$inferSelect[] = [];
  try {
    userProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.updatedAt))
      .limit(10);
  } catch {
    // DB not connected yet
  }

  const totalProjects = userProjects.length;
  const avgReadiness = totalProjects
    ? Math.round(userProjects.reduce((s, p) => s + (p.readinessScore ?? 0), 0) / totalProjects)
    : 0;
  const avgSecurity = totalProjects
    ? Math.round(userProjects.reduce((s, p) => s + (p.securityScore ?? 0), 0) / totalProjects)
    : 0;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Your AI product planning command centre</p>
        </div>
        <Link href="/new-blueprint">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            New Blueprint
          </Button>
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Projects</span>
              <FileText className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold text-foreground">{totalProjects}</p>
            <p className="text-xs text-muted-foreground mt-1">Total blueprints</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Blueprint Readiness</span>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className={cn("text-3xl font-bold", scoreColor(avgReadiness))}>{avgReadiness}%</p>
            <p className="text-xs text-muted-foreground mt-1">{scoreLabel(avgReadiness)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Security Score</span>
              <Shield className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className={cn("text-3xl font-bold", scoreColor(avgSecurity))}>{avgSecurity}/100</p>
            <p className={cn("text-xs mt-1 font-medium", avgSecurity < 60 ? "text-amber-500" : "text-muted-foreground")}>
              {avgSecurity < 60 ? "Needs Review" : "Good"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Agent Status</span>
              <Bot className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold text-foreground">—</p>
            <p className="text-xs text-muted-foreground mt-1">Not Connected</p>
          </CardContent>
        </Card>
      </div>

      {/* Projects list */}
      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">Recent Projects</h2>
          </div>

          {userProjects.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-12 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Plus className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">No projects yet</h3>
                <p className="text-muted-foreground text-sm mb-4 max-w-xs">
                  Create your first blueprint to generate a complete build-ready product plan with AI.
                </p>
                <Link href="/new-blueprint">
                  <Button size="sm">Create Blueprint</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {userProjects.map((project) => (
                <Card key={project.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <h3 className="font-semibold text-foreground truncate">{project.name}</h3>
                          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full capitalize", STATUS_COLORS[project.status ?? "draft"])}>
                            {project.status}
                          </span>
                        </div>
                        {project.description && (
                          <p className="text-muted-foreground text-sm line-clamp-1 mb-3">{project.description}</p>
                        )}
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-muted-foreground">Blueprint</span>
                              <span className={cn("text-xs font-semibold", scoreColor(project.readinessScore ?? 0))}>
                                {project.readinessScore ?? 0}%
                              </span>
                            </div>
                            <Progress value={project.readinessScore ?? 0} className="h-1.5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-muted-foreground">Security</span>
                              <span className={cn("text-xs font-semibold", scoreColor(project.securityScore ?? 0))}>
                                {project.securityScore ?? 0}/100
                              </span>
                            </div>
                            <Progress value={project.securityScore ?? 0} className="h-1.5" />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatRelative(project.updatedAt)}
                        </div>
                        <Link href={`/projects/${project.id}/documents`}>
                          <Button size="sm" variant="outline" className="gap-1">
                            Open <ArrowRight className="w-3 h-3" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Next action */}
          <Card className="bg-primary text-primary-foreground border-0">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold opacity-90">AI Build Advisor</span>
              </div>
              {totalProjects === 0 ? (
                <>
                  <p className="text-sm opacity-90 mb-3 leading-relaxed">
                    Start by creating your first blueprint. Describe your app and the AI will generate 7 complete build documents.
                  </p>
                  <Link href="/new-blueprint">
                    <Button size="sm" variant="secondary" className="w-full gap-1">
                      Create Blueprint <ArrowRight className="w-3 h-3" />
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-sm opacity-90 mb-3 leading-relaxed">
                    Your project is <strong>{avgReadiness}%</strong> ready for development.
                  </p>
                  {avgSecurity < 60 && (
                    <div className="flex items-start gap-2 bg-white/10 rounded-lg p-3 mb-3">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <p className="text-xs opacity-90">Review Backend Schema for data integrity and RLS policies before sending tasks to your agent.</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* AI credit usage */}
          <CreditUsageWidget />

          {/* Document types quick guide */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold">Generated Documents</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="space-y-2">
                {Object.entries(DOC_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <Badge variant="outline" className="text-xs">
                      {totalProjects > 0 ? "Ready" : "Pending"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4 space-y-2">
              <Link href="/new-blueprint" className="block">
                <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                  <Plus className="w-4 h-4" /> New Blueprint
                </Button>
              </Link>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2" disabled>
                <CheckSquare className="w-4 h-4" /> View All Tasks
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2" disabled>
                <Bot className="w-4 h-4" /> Connect Agent
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
