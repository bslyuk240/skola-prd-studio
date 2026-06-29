"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StepAppIdentity } from "./steps/step-app-identity";
import { StepPlatformStack } from "./steps/step-platform-stack";
import { StepProductStructure } from "./steps/step-product-structure";
import { StepSecurityLevel } from "./steps/step-security-level";
import { StepReviewGenerate } from "./steps/step-review-generate";
import { cn } from "@/lib/utils";

export type WizardData = {
  // Step 1
  appName: string;
  shortDescription: string;
  longDescription: string;
  appCategory: string;
  targetUsers: string;
  problemSolved: string;
  mainGoal: string;
  // Step 2
  platformType: string;
  frontendFramework: string;
  backendFramework: string;
  database: string;
  authProvider: string;
  hostingProvider: string;
  fileStorage: string;
  paymentProvider: string;
  // Step 3
  userRoles: string;
  mainFeatures: string;
  adminFeatures: string;
  monetisationModel: string;
  notificationNeeds: string;
  integrationNeeds: string;
  multiTenancy: boolean;
  fileUpload: boolean;
  // Step 4
  securityLevel: "basic" | "standard" | "high" | "enterprise";
  securityToggles: Record<string, boolean>;
};

const STEPS = [
  { id: 1, label: "App Identity" },
  { id: 2, label: "Stack Choices" },
  { id: 3, label: "Product Structure" },
  { id: 4, label: "Security Level" },
  { id: 5, label: "Generate Blueprint" },
];

const DEFAULT_DATA: WizardData = {
  appName: "",
  shortDescription: "",
  longDescription: "",
  appCategory: "",
  targetUsers: "",
  problemSolved: "",
  mainGoal: "",
  platformType: "web",
  frontendFramework: "",
  backendFramework: "",
  database: "",
  authProvider: "",
  hostingProvider: "",
  fileStorage: "",
  paymentProvider: "",
  userRoles: "",
  mainFeatures: "",
  adminFeatures: "",
  monetisationModel: "",
  notificationNeeds: "",
  integrationNeeds: "",
  multiTenancy: false,
  fileUpload: false,
  securityLevel: "standard",
  securityToggles: {
    serverSideValidation: true,
    inputSanitisation: true,
    rateLimiting: true,
    accountLockout: true,
    passwordHashing: true,
    safeErrorMessages: true,
    rbac: true,
    auditLogging: false,
    secureFileUploads: false,
    secureSessionHandling: true,
    envVarProtection: true,
  },
};

interface BlueprintWizardProps {
  defaultSecurityLevel?: "basic" | "standard" | "high" | "enterprise";
  defaultSecurityToggles?: Record<string, boolean> | null;
}

export function BlueprintWizard({ defaultSecurityLevel, defaultSecurityToggles }: BlueprintWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>({
    ...DEFAULT_DATA,
    ...(defaultSecurityLevel ? { securityLevel: defaultSecurityLevel } : {}),
    ...(defaultSecurityToggles ? { securityToggles: defaultSecurityToggles } : {}),
  });
  const [loading, setLoading] = useState(false);

  function update(partial: Partial<WizardData>) {
    setData((prev) => ({ ...prev, ...partial }));
  }

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create project");
      const { projectId } = await res.json();
      toast.success("Blueprint created! Generating documents…");
      router.push(`/projects/${projectId}/documents`);
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
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
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors",
                  step === s.id
                    ? "bg-primary border-primary text-primary-foreground"
                    : step > s.id
                    ? "bg-primary/20 border-primary text-primary"
                    : "bg-muted border-border text-muted-foreground"
                )}
              >
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

      {/* Step content */}
      <div className="bg-card border border-border rounded-2xl p-10 shadow-sm">
        {step === 1 && <StepAppIdentity {...stepProps} onNext={() => setStep(2)} />}
        {step === 2 && <StepPlatformStack {...stepProps} onBack={() => setStep(1)} onNext={() => setStep(3)} />}
        {step === 3 && <StepProductStructure {...stepProps} onBack={() => setStep(2)} onNext={() => setStep(4)} />}
        {step === 4 && <StepSecurityLevel {...stepProps} onBack={() => setStep(3)} onNext={() => setStep(5)} />}
        {step === 5 && <StepReviewGenerate {...stepProps} onBack={() => setStep(4)} onGenerate={handleGenerate} loading={loading} />}
      </div>
    </div>
  );
}
