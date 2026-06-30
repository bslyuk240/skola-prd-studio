"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Zap, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreditStatus {
  consumed: number;
  limit: number;
  remaining: number;
  percentage: number;
  breakdown: {
    blueprintDocs: number;
    featureDocs: number;
    securityScans: number;
  };
}

export function CreditUsageWidget() {
  const [status, setStatus] = useState<CreditStatus | null>(null);

  useEffect(() => {
    fetch("/api/user/credits")
      .then((r) => r.json())
      .then((data) => setStatus(data))
      .catch(() => {});
  }, []);

  if (!status) {
    return (
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">AI Credits</span>
            <Zap className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="h-7 bg-muted rounded animate-pulse mb-2" />
          <div className="h-1.5 bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  const isWarning = status.percentage >= 70;
  const isCritical = status.percentage >= 90;

  return (
    <Link href="/settings" className="block group">
      <Card className={cn("transition-shadow hover:shadow-sm", isCritical && "border-red-200")}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">AI Credits</span>
            <div className="flex items-center gap-1.5">
              <Zap className={cn("w-4 h-4", isCritical ? "text-red-500" : isWarning ? "text-amber-500" : "text-muted-foreground")} />
              <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          <div className="flex items-end justify-between mb-2">
            <p className={cn("text-3xl font-bold", isCritical ? "text-red-600" : isWarning ? "text-amber-500" : "text-foreground")}>
              {status.consumed.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mb-1">/ {status.limit.toLocaleString()}</p>
          </div>

          <Progress
            value={status.percentage}
            className={cn("h-1.5 mb-3", isCritical ? "[&>div]:bg-red-500" : isWarning ? "[&>div]:bg-amber-500" : "")}
          />

          <div className="space-y-1.5">
            {[
              { label: "Blueprint docs", value: status.breakdown.blueprintDocs },
              { label: "Feature docs", value: status.breakdown.featureDocs },
              { label: "Security scans", value: status.breakdown.securityScans },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium text-foreground">{value}</span>
              </div>
            ))}
          </div>

          {isCritical && (
            <p className="text-xs text-red-600 font-medium mt-3">
              {status.remaining} credits remaining — close to limit.
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

// Compact version for sidebar
export function CreditUsageCompact() {
  const [status, setStatus] = useState<CreditStatus | null>(null);

  useEffect(() => {
    fetch("/api/user/credits")
      .then((r) => r.json())
      .then((data) => setStatus(data))
      .catch(() => {});
  }, []);

  if (!status) {
    return (
      <div className="px-3 py-2">
        <div className="h-1.5 bg-sidebar-accent/40 rounded-full animate-pulse" />
      </div>
    );
  }

  const isWarning = status.percentage >= 70;
  const isCritical = status.percentage >= 90;

  return (
    <Link href="/settings" className="block px-3 py-2 rounded-md hover:bg-sidebar-accent/50 transition-colors">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Zap className={cn("w-3 h-3", isCritical ? "text-red-400" : isWarning ? "text-amber-400" : "text-sidebar-foreground/40")} />
          <span className="text-xs text-sidebar-foreground/50">AI Credits</span>
        </div>
        <span className={cn("text-xs font-medium", isCritical ? "text-red-400" : isWarning ? "text-amber-400" : "text-sidebar-foreground/60")}>
          {status.consumed}/{status.limit}
        </span>
      </div>
      <div className="w-full h-1 bg-sidebar-accent/30 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isCritical ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-primary"
          )}
          style={{ width: `${status.percentage}%` }}
        />
      </div>
    </Link>
  );
}
