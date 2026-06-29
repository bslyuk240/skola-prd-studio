import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { featureRequests, repoConnections } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, GitBranch, Clock, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { formatRelative } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground", icon: Clock },
  generating: { label: "Generating", className: "bg-blue-100 text-blue-700", icon: Loader2 },
  ready: { label: "Ready", className: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  approved: { label: "Approved", className: "bg-green-100 text-green-700", icon: CheckCircle2 },
};

export default async function FeaturePlannerPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const requests = await db
    .select()
    .from(featureRequests)
    .where(eq(featureRequests.userId, userId))
    .orderBy(desc(featureRequests.createdAt))
    .limit(20);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Feature Impact Planner</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Plan new features for existing projects — connect your repo, describe the feature, get a full impact analysis.
          </p>
        </div>
        <Link href="/feature-planner/new">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Plan a Feature
          </Button>
        </Link>
      </div>

      {/* How it works */}
      {requests.length === 0 && (
        <div className="grid grid-cols-4 gap-4 mb-10">
          {[
            { step: 1, title: "Connect Repo", desc: "Paste your GitHub URL or provide project context manually." },
            { step: 2, title: "Auto-Scan", desc: "We detect your stack, routes, schema, modules, and patterns." },
            { step: 3, title: "Describe Feature", desc: "Tell us what you want to add and answer 8 quick questions." },
            { step: 4, title: "Get the Plan", desc: "Receive 9 documents: impact analysis, schema changes, tasks, security, deployment plan." },
          ].map(({ step, title, desc }) => (
            <div key={step} className="bg-card border border-border rounded-lg p-4">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center mb-3">
                {step}
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      )}

      {requests.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl p-16 text-center">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mx-auto mb-4">
            <GitBranch className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground mb-2">No feature plans yet</h3>
          <p className="text-muted-foreground text-sm mb-4 max-w-xs mx-auto">
            Connect an existing repo and describe a feature to get a full impact analysis and implementation plan.
          </p>
          <Link href="/feature-planner/new">
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" /> Plan Your First Feature
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const cfg = STATUS_CONFIG[req.status ?? "draft"];
            const Icon = cfg.icon;
            return (
              <Card key={req.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">{req.featureName}</h3>
                        <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded", cfg.className)}>
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                        {req.scopeLevel && (
                          <Badge variant="outline" className="text-xs capitalize">{req.scopeLevel}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">{req.featureDescription}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground">{formatRelative(req.createdAt)}</span>
                      <Link href={`/feature-planner/${req.id}`}>
                        <Button size="sm" variant="outline" className="gap-1">
                          Open <ArrowRight className="w-3 h-3" />
                        </Button>
                      </Link>
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
