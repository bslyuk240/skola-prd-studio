"use client";

import type { FeatureWizardData } from "../feature-wizard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, FileText, Shield, Database, Map, Code2, GitBranch, Palette, CheckSquare, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  data: FeatureWizardData;
  update: (partial: Partial<FeatureWizardData>) => void;
  onBack: () => void;
  onGenerate: () => void;
  loading: boolean;
}

const FEATURE_DOCS = [
  { icon: FileText, label: "Feature Requirements Document" },
  { icon: Map, label: "Impact Analysis" },
  { icon: Database, label: "Schema & API Changes" },
  { icon: Code2, label: "API Changes" },
  { icon: Palette, label: "UI Change Plan" },
  { icon: Shield, label: "Security Impact Checklist" },
  { icon: GitBranch, label: "Implementation Tasks" },
  { icon: CheckSquare, label: "Test Plan" },
  { icon: Rocket, label: "Deployment & Rollback Plan" },
];

export function StepClarify({ data, update, onBack, onGenerate, loading }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1">Clarify the Feature</h2>
        <p className="text-muted-foreground text-sm">
          Answer these questions to make the impact analysis specific to your project.
        </p>
      </div>

      <div className="grid xl:grid-cols-2 gap-8">
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="affectedRoles">Which user roles does this feature affect?</Label>
            <Input
              id="affectedRoles"
              placeholder="e.g. Staff, Manager, Admin"
              value={data.affectedRoles}
              onChange={(e) => update({ affectedRoles: e.target.value })}
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Feature requirements</p>
            <div className="border border-border rounded-lg divide-y divide-border">
              {[
                { key: "affectsPermissions", label: "Affects existing permissions or roles", desc: "Changes who can access what" },
                { key: "needsNewTables", label: "Requires new database tables", desc: "Adds new data structures" },
                { key: "needsNotifications", label: "Requires notifications", desc: "Email, in-app, or push notifications" },
                { key: "affectsDashboard", label: "Affects the main dashboard", desc: "Adds or changes dashboard content" },
                { key: "mobileRequired", label: "Must work on mobile", desc: "Mobile UI is required, not optional" },
                { key: "affectsBilling", label: "Affects billing or subscriptions", desc: "Gated behind a plan or changes pricing" },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Switch
                    checked={!!data[key as keyof FeatureWizardData] as boolean}
                    onCheckedChange={(v) => update({ [key]: v } as Partial<FeatureWizardData>)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Feature Scope</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "mvp", label: "MVP", desc: "Core functionality only" },
                { value: "full", label: "Full", desc: "Complete with all edge cases" },
              ].map(({ value, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => update({ scopeLevel: value as "mvp" | "full" })}
                  className={cn(
                    "text-left border rounded-lg p-3 transition-colors",
                    data.scopeLevel === value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  )}
                >
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="additionalContext">Additional context</Label>
            <Textarea
              id="additionalContext"
              placeholder="Anything else relevant — constraints, existing similar features, business rules, integration requirements…"
              rows={4}
              value={data.additionalContext}
              onChange={(e) => update({ additionalContext: e.target.value })}
            />
          </div>
        </div>

        {/* Summary + docs to generate */}
        <div className="space-y-4">
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Feature Summary</p>
            <p className="text-sm font-semibold text-foreground mb-1">{data.featureName}</p>
            <p className="text-xs text-muted-foreground line-clamp-3">{data.featureDescription}</p>
          </div>

          <div className="border border-border rounded-lg p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Documents to generate ({FEATURE_DOCS.length})
            </p>
            <div className="space-y-2">
              {FEATURE_DOCS.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="text-xs text-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} disabled={loading}>← Back</Button>
        <Button onClick={onGenerate} disabled={loading} className="gap-2 min-w-44">
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating plan…</>
            : "Generate Feature Plan →"}
        </Button>
      </div>
    </div>
  );
}
