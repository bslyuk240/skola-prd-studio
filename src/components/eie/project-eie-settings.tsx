"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { isEieEnabledForProject } from "@/lib/eie/project-settings";

type ProjectEieSettingsProps = {
  project: Project;
};

export function ProjectEieSettings({ project }: ProjectEieSettingsProps) {
  const [enabled, setEnabled] = useState(isEieEnabledForProject(project));
  const [saving, setSaving] = useState(false);

  async function handleToggle(checked: boolean) {
    setEnabled(checked);
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enableEieCrossReferencing: checked }),
      });
      if (!res.ok) throw new Error();
      toast.success(
        checked
          ? "EIE cross-referencing enabled for this project"
          : "EIE cross-referencing disabled for this project"
      );
    } catch {
      setEnabled(!checked);
      toast.error("Failed to save project setting");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Engineering Intelligence</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="eie-toggle" className="text-sm">
              Enable EIE Cross-Referencing
            </Label>
            <p className="text-xs text-muted-foreground">
              Inject curated engineering concepts into document generation prompts
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <Switch
              id="eie-toggle"
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={saving}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
