"use client";

import type { FeatureWizardData } from "../feature-wizard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  data: FeatureWizardData;
  update: (partial: Partial<FeatureWizardData>) => void;
  onBack: () => void;
  onNext: () => void;
}

const EXAMPLES = [
  "Add shift swap requests for support workers",
  "Add a team invitation and workspace member management system",
  "Add Stripe subscription billing with three pricing tiers",
  "Add real-time notifications using Supabase Realtime",
  "Add an admin analytics dashboard with export to CSV",
];

export function StepDescribeFeature({ data, update, onBack, onNext }: Props) {
  const canProceed = data.featureName.trim() && data.featureDescription.trim();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1">Describe the Feature</h2>
        <p className="text-muted-foreground text-sm">
          Be specific. The clearer you are, the more accurate the impact analysis.
        </p>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="featureName">Feature Name <span className="text-destructive">*</span></Label>
          <Input
            id="featureName"
            placeholder="e.g. Shift Swap Request System"
            value={data.featureName}
            onChange={(e) => update({ featureName: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="featureDescription">
            Feature Description <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="featureDescription"
            placeholder="Describe what this feature does, who uses it, and what problem it solves. Include any specific requirements or constraints."
            rows={6}
            value={data.featureDescription}
            onChange={(e) => update({ featureDescription: e.target.value })}
          />
        </div>

        {/* Examples */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Examples — click to use as a starting point:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => update({ featureName: ex, featureDescription: `I want to add: ${ex}. ` })}
                className="text-xs bg-muted hover:bg-accent border border-border rounded px-2.5 py-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>← Back</Button>
        <Button onClick={onNext} disabled={!canProceed}>Next: Clarify Details →</Button>
      </div>
    </div>
  );
}
