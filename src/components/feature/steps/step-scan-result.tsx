"use client";

import type { FeatureWizardData } from "../feature-wizard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Database, Globe, Lock, Layers, Code2, TestTube, Server, Package } from "lucide-react";

interface Props {
  data: FeatureWizardData;
  update: (partial: Partial<FeatureWizardData>) => void;
  onBack: () => void;
  onNext: () => void;
}

const STACK_ICONS: Record<string, React.ElementType> = {
  framework: Globe,
  database: Database,
  auth: Lock,
  ui: Layers,
  stateManagement: Code2,
  testing: TestTube,
  deployment: Server,
  packageManager: Package,
  apiStyle: Code2,
  language: Code2,
};

export function StepScanResult({ data, onBack, onNext }: Props) {
  const { scanResult } = data;
  const stack = scanResult?.detectedStack;

  if (!scanResult) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No scan result. Go back and scan a project.</p>
        <Button variant="outline" onClick={onBack} className="mt-4">← Back</Button>
      </div>
    );
  }

  const stackRows = stack ? Object.entries(stack).filter(([k, v]) => k !== "otherDeps" && v && v !== "Not detected" && v !== "None detected") : [];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <h2 className="text-xl font-bold text-foreground">Project Scanned</h2>
        </div>
        <p className="text-muted-foreground text-sm">
          {scanResult.fileCount ? `${scanResult.fileCount} files analysed.` : ""} Review what was detected before proceeding.
        </p>
      </div>

      {/* Project summary */}
      {scanResult.projectSummary && (
        <div className="bg-muted/50 border border-border rounded-lg p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Project Summary</p>
          <p className="text-sm text-foreground leading-relaxed">{scanResult.projectSummary}</p>
        </div>
      )}

      <div className="grid xl:grid-cols-2 gap-6">
        {/* Detected stack */}
        {stackRows.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Detected Technology Stack</p>
            <div className="border border-border rounded-lg divide-y divide-border">
              {stackRows.map(([key, value]) => {
                const Icon = STACK_ICONS[key] ?? Code2;
                return (
                  <div key={key} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                    </div>
                    <span className="text-xs font-medium text-foreground">{value as string}</span>
                  </div>
                );
              })}
            </div>
            {stack?.otherDeps && stack.otherDeps.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {stack.otherDeps.map((dep) => (
                  <Badge key={dep} variant="outline" className="text-xs">{dep}</Badge>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          {/* Detected modules */}
          {scanResult.modules && scanResult.modules.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Detected Modules / Pages</p>
              <div className="flex flex-wrap gap-1.5">
                {scanResult.modules.map((m) => (
                  <Badge key={m} variant="outline" className="text-xs bg-primary/5 border-primary/30 text-primary">{m}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Schema files */}
          {scanResult.dbSchemaFiles && scanResult.dbSchemaFiles.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Schema Files Found</p>
              <div className="space-y-1">
                {scanResult.dbSchemaFiles.map((f) => (
                  <p key={f} className="text-xs font-mono text-muted-foreground bg-muted rounded px-2 py-1">{f}</p>
                ))}
              </div>
            </div>
          )}

          {/* API routes sample */}
          {scanResult.apiRoutes && scanResult.apiRoutes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                API Routes ({scanResult.apiRoutes.length} found)
              </p>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {scanResult.apiRoutes.slice(0, 12).map((r) => (
                  <p key={r} className="text-xs font-mono text-muted-foreground bg-muted rounded px-2 py-1 truncate">{r}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Manual context fallback */}
      {data.provider === "manual" && !stack && (
        <div className="bg-muted/50 border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Manual context was recorded. The AI will use it when generating your feature analysis.</p>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>← Re-scan</Button>
        <Button onClick={onNext}>Describe the Feature →</Button>
      </div>
    </div>
  );
}
