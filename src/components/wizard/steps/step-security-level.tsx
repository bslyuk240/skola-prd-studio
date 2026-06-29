"use client";

import { WizardData } from "../blueprint-wizard";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const LEVELS = [
  { value: "basic", label: "Basic", desc: "Minimal security controls. Suitable for MVPs and internal tools.", color: "border-blue-200 bg-blue-50 text-blue-700" },
  { value: "standard", label: "Standard", desc: "Recommended for most apps. Covers auth, validation, rate limiting.", color: "border-primary bg-primary/5 text-primary" },
  { value: "high", label: "High Security", desc: "For apps handling sensitive data. Includes audit logs, strict RBAC.", color: "border-amber-300 bg-amber-50 text-amber-700" },
  { value: "enterprise", label: "Enterprise", desc: "Maximum security. Full compliance, MFA, and advanced monitoring.", color: "border-red-300 bg-red-50 text-red-700" },
] as const;

const TOGGLES: { key: keyof WizardData["securityToggles"]; label: string; desc: string }[] = [
  { key: "serverSideValidation", label: "Server-side Validation", desc: "Validate all inputs on the server" },
  { key: "inputSanitisation", label: "Input Sanitisation", desc: "Clean HTML tags, scripts, dangerous chars" },
  { key: "rateLimiting", label: "Rate Limiting", desc: "Limit login, signup, reset requests" },
  { key: "accountLockout", label: "Account Lockout", desc: "Lock accounts after repeated failures" },
  { key: "passwordHashing", label: "Password Hashing", desc: "Bcrypt or Argon2id — never plain text" },
  { key: "safeErrorMessages", label: "Safe Error Messages", desc: '"Incorrect email or password" style' },
  { key: "rbac", label: "Role-based Access Control", desc: "Permissions per role across the app" },
  { key: "auditLogging", label: "Audit Logging", desc: "Log important security events" },
  { key: "secureFileUploads", label: "Secure File Uploads", desc: "Validate type, size, virus scan" },
  { key: "secureSessionHandling", label: "Secure Sessions", desc: "HttpOnly cookies, session rotation" },
  { key: "envVarProtection", label: "Env Var Protection", desc: "No secrets in code or client bundles" },
];

interface Props {
  data: WizardData;
  update: (partial: Partial<WizardData>) => void;
  onBack: () => void;
  onNext: () => void;
}

export function StepSecurityLevel({ data, update, onBack, onNext }: Props) {
  function setLevel(level: WizardData["securityLevel"]) {
    const toggles = { ...data.securityToggles };
    if (level === "basic") {
      Object.keys(toggles).forEach((k) => (toggles[k] = ["serverSideValidation", "passwordHashing", "safeErrorMessages", "envVarProtection"].includes(k)));
    } else if (level === "standard") {
      Object.keys(toggles).forEach((k) => (toggles[k] = !["auditLogging", "secureFileUploads"].includes(k)));
    } else if (level === "high" || level === "enterprise") {
      Object.keys(toggles).forEach((k) => (toggles[k] = true));
    }
    update({ securityLevel: level, securityToggles: toggles });
  }

  function toggleItem(key: string, val: boolean) {
    update({ securityToggles: { ...data.securityToggles, [key]: val } });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1">Security Level</h2>
        <p className="text-muted-foreground text-sm">Choose a security level — you can customise individual controls below.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {LEVELS.map(({ value, label, desc, color }) => (
          <button
            key={value}
            type="button"
            onClick={() => setLevel(value as WizardData["securityLevel"])}
            className={cn(
              "border-2 rounded-xl p-4 text-left transition-colors",
              data.securityLevel === value ? color : "border-border bg-background hover:border-border/80"
            )}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Shield className="w-4 h-4" />
              <span className="font-semibold text-sm">{label}</span>
            </div>
            <p className="text-xs opacity-80 leading-relaxed">{desc}</p>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Security Controls</Label>
        <div className="border border-border rounded-xl divide-y divide-border">
          {TOGGLES.map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch
                checked={!!data.securityToggles[key]}
                onCheckedChange={(v) => toggleItem(key, v)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>← Back</Button>
        <Button onClick={onNext}>Next: Review & Generate →</Button>
      </div>
    </div>
  );
}
