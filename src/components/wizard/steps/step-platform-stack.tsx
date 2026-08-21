"use client";

import { WizardData } from "../blueprint-wizard";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PLATFORM_TYPES, STACK_OPTIONS } from "@/lib/wizard-stack-options";

interface Props {
  data: WizardData;
  update: (partial: Partial<WizardData>) => void;
  onBack: () => void;
  onNext: () => void;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger>
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export function StepPlatformStack({ data, update, onBack, onNext }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1">Platform & Stack</h2>
        <p className="text-muted-foreground text-sm">Choose your platform type and technology preferences.</p>
      </div>

      <div className="space-y-3">
        <Label>Platform Type</Label>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {PLATFORM_TYPES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => update({ platformType: value })}
              className={cn(
                "border rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left",
                data.platformType === value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <SelectField label="Frontend Framework" value={data.frontendFramework} options={[...STACK_OPTIONS.frontend]} onChange={(v) => update({ frontendFramework: v })} />
        <SelectField label="Backend Framework" value={data.backendFramework} options={[...STACK_OPTIONS.backend]} onChange={(v) => update({ backendFramework: v })} />
        <SelectField label="Database" value={data.database} options={[...STACK_OPTIONS.database]} onChange={(v) => update({ database: v })} />
        <SelectField label="Authentication" value={data.authProvider} options={[...STACK_OPTIONS.auth]} onChange={(v) => update({ authProvider: v })} />
        <SelectField label="Hosting / Deployment" value={data.hostingProvider} options={[...STACK_OPTIONS.hosting]} onChange={(v) => update({ hostingProvider: v })} />
        <SelectField label="File Storage" value={data.fileStorage} options={[...STACK_OPTIONS.storage]} onChange={(v) => update({ fileStorage: v })} />
        <SelectField label="Payment Provider" value={data.paymentProvider} options={[...STACK_OPTIONS.payment]} onChange={(v) => update({ paymentProvider: v })} />
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>← Back</Button>
        <Button onClick={onNext}>Next: Product Structure →</Button>
      </div>
    </div>
  );
}
