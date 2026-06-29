"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StepConnect } from "./steps/step-connect";
import { StepScanResult } from "./steps/step-scan-result";
import { StepDescribeFeature } from "./steps/step-describe-feature";
import { StepClarify } from "./steps/step-clarify";
import { cn } from "@/lib/utils";

export type ScanResult = {
  connectionId: string;
  detectedStack?: {
    framework: string;
    language: string;
    database: string;
    auth: string;
    ui: string;
    stateManagement: string;
    testing: string;
    deployment: string;
    packageManager: string;
    apiStyle: string;
    otherDeps: string[];
  };
  modules?: string[];
  apiRoutes?: string[];
  dbSchemaFiles?: string[];
  fileCount?: number;
  projectSummary?: string;
};

export type FeatureWizardData = {
  // Step 1 — connection
  provider: "github" | "manual";
  repoUrl: string;
  branch: string;
  accessToken: string;
  manualContext: string;
  // Step 2 — scan result
  scanResult: ScanResult | null;
  // Step 3 — feature description
  featureName: string;
  featureDescription: string;
  // Step 4 — clarification
  affectedRoles: string;
  affectsPermissions: boolean;
  needsNewTables: boolean;
  needsNotifications: boolean;
  affectsDashboard: boolean;
  mobileRequired: boolean;
  affectsBilling: boolean;
  scopeLevel: "mvp" | "full";
  additionalContext: string;
};

const STEPS = [
  { id: 1, label: "Connect Project" },
  { id: 2, label: "Project Scan" },
  { id: 3, label: "Describe Feature" },
  { id: 4, label: "Clarify & Generate" },
];

const DEFAULT_DATA: FeatureWizardData = {
  provider: "github",
  repoUrl: "",
  branch: "main",
  accessToken: "",
  manualContext: "",
  scanResult: null,
  featureName: "",
  featureDescription: "",
  affectedRoles: "",
  affectsPermissions: false,
  needsNewTables: false,
  needsNotifications: false,
  affectsDashboard: false,
  mobileRequired: false,
  affectsBilling: false,
  scopeLevel: "mvp",
  additionalContext: "",
};

export function FeatureWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<FeatureWizardData>(DEFAULT_DATA);
  const [submitting, setSubmitting] = useState(false);

  function update(partial: Partial<FeatureWizardData>) {
    setData((prev) => ({ ...prev, ...partial }));
  }

  async function handleGenerate() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/feature/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoConnectionId: data.scanResult?.connectionId,
          featureName: data.featureName,
          featureDescription: data.featureDescription,
          affectedRoles: data.affectedRoles,
          affectsPermissions: data.affectsPermissions,
          needsNewTables: data.needsNewTables,
          needsNotifications: data.needsNotifications,
          affectsDashboard: data.affectsDashboard,
          mobileRequired: data.mobileRequired,
          affectsBilling: data.affectsBilling,
          scopeLevel: data.scopeLevel,
          additionalContext: data.additionalContext,
        }),
      });
      if (!res.ok) throw new Error("Failed to create feature request");
      const { requestId } = await res.json();
      toast.success("Feature plan created! Generating documents…");
      router.push(`/feature-planner/${requestId}`);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const stepProps = { data, update };

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-0 flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors",
                step === s.id ? "bg-primary border-primary text-primary-foreground"
                  : step > s.id ? "bg-primary/20 border-primary text-primary"
                  : "bg-muted border-border text-muted-foreground"
              )}>
                {step > s.id ? "✓" : s.id}
              </div>
              <span className={cn("text-xs font-medium whitespace-nowrap", step === s.id ? "text-foreground" : "text-muted-foreground")}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("flex-1 h-0.5 mx-2 mb-4 transition-colors", step > s.id ? "bg-primary" : "bg-border")} />
            )}
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-10 shadow-sm">
        {step === 1 && <StepConnect {...stepProps} onNext={(result) => { update({ scanResult: result }); setStep(2); }} />}
        {step === 2 && <StepScanResult {...stepProps} onBack={() => setStep(1)} onNext={() => setStep(3)} />}
        {step === 3 && <StepDescribeFeature {...stepProps} onBack={() => setStep(2)} onNext={() => setStep(4)} />}
        {step === 4 && <StepClarify {...stepProps} onBack={() => setStep(3)} onGenerate={handleGenerate} loading={submitting} />}
      </div>
    </div>
  );
}
