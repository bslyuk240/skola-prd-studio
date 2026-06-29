"use client";

import { WizardData } from "../blueprint-wizard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Shield, Database, GitBranch, Layers, Map, Palette } from "lucide-react";

const DOCS = [
  { icon: FileText, label: "Product Requirements Document" },
  { icon: FileText, label: "Technical Requirements Document" },
  { icon: Map, label: "App Flow" },
  { icon: Palette, label: "UI/UX Design Brief" },
  { icon: Database, label: "Backend Schema" },
  { icon: GitBranch, label: "Implementation Plan" },
  { icon: Shield, label: "Security Blueprint" },
];

interface Props {
  data: WizardData;
  update: (partial: Partial<WizardData>) => void;
  onBack: () => void;
  onGenerate: () => void;
  loading: boolean;
}

export function StepReviewGenerate({ data, onBack, onGenerate, loading }: Props) {
  const enabledToggles = Object.entries(data.securityToggles).filter(([, v]) => v).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1">Review & Generate</h2>
        <p className="text-muted-foreground text-sm">Review your project details before generating all 7 build documents.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">App Details</p>
          <div className="space-y-1.5">
            <SummaryRow label="Name" value={data.appName || "—"} />
            <SummaryRow label="Category" value={data.appCategory || "—"} />
            <SummaryRow label="Platform" value={data.platformType || "—"} />
            <SummaryRow label="Target Users" value={data.targetUsers || "—"} />
          </div>
        </div>
        <div className="border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tech Stack</p>
          <div className="space-y-1.5">
            <SummaryRow label="Frontend" value={data.frontendFramework || "Not specified"} />
            <SummaryRow label="Backend" value={data.backendFramework || "Not specified"} />
            <SummaryRow label="Database" value={data.database || "Not specified"} />
            <SummaryRow label="Auth" value={data.authProvider || "Not specified"} />
            <SummaryRow label="Payment" value={data.paymentProvider || "Not specified"} />
          </div>
        </div>
        <div className="border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Product</p>
          <div className="space-y-1.5">
            <SummaryRow label="Roles" value={data.userRoles || "—"} />
            <SummaryRow label="Monetisation" value={data.monetisationModel || "—"} />
            <SummaryRow label="Notifications" value={data.notificationNeeds || "—"} />
            <SummaryRow label="Multi-tenancy" value={data.multiTenancy ? "Yes" : "No"} />
            <SummaryRow label="File Uploads" value={data.fileUpload ? "Yes" : "No"} />
          </div>
        </div>
        <div className="border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Security</p>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="capitalize">{data.securityLevel}</Badge>
            <span className="text-xs text-muted-foreground">{enabledToggles} controls enabled</span>
          </div>
        </div>
      </div>

      {/* Documents to generate */}
      <div className="border border-border rounded-xl p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Documents to be generated</p>
        <div className="grid grid-cols-2 gap-2">
          {DOCS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2.5 bg-muted/50 rounded-lg px-3 py-2">
              <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-sm text-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} disabled={loading}>← Back</Button>
        <Button onClick={onGenerate} disabled={loading} className="gap-2 min-w-40">
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating project…
            </>
          ) : (
            "Generate Blueprint →"
          )}
        </Button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs font-medium text-foreground text-right truncate">{value}</span>
    </div>
  );
}
