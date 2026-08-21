"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ProjectBlueprint } from "@/lib/zod/blueprint-schemas";
import type { assumptionEntrySchema } from "@/lib/zod/blueprint-schemas";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STACK_FIELD_LABELS, STACK_OPTIONS, type StackFieldKey } from "@/lib/wizard-stack-options";
import { Loader2, Server, Layers, Plug, Globe, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

type AssumptionEntry = z.infer<typeof assumptionEntrySchema>;

type StackFields = {
  frontendFramework: string;
  backendFramework: string;
  database: string;
  authProvider: string;
  hostingProvider: string;
  fileStorage: string;
  paymentProvider: string;
};

const STACK_FORM_KEYS: Record<StackFieldKey, keyof StackFields> = {
  frontend: "frontendFramework",
  backend: "backendFramework",
  database: "database",
  auth: "authProvider",
  hosting: "hostingProvider",
  storage: "fileStorage",
  payment: "paymentProvider",
};

type Props = {
  projectId: string;
  projectName: string;
  blueprint: ProjectBlueprint;
  stackFields: StackFields;
  approved: boolean;
};

function nextAssumptionId(assumptions: AssumptionEntry[]): string {
  const numbers = assumptions
    .map((item) => Number.parseInt(item.id.replace(/\D/g, ""), 10))
    .filter((value) => !Number.isNaN(value));
  const next = numbers.length === 0 ? 1 : Math.max(...numbers) + 1;
  return `ASM-${String(next).padStart(3, "0")}`;
}

function stackPayload(fields: StackFields) {
  return {
    frontend: fields.frontendFramework || undefined,
    backend: fields.backendFramework || undefined,
    database: fields.database || undefined,
    auth: fields.authProvider || undefined,
    hosting: fields.hostingProvider || undefined,
    storage: fields.fileStorage !== "None" ? fields.fileStorage : undefined,
    payment: fields.paymentProvider !== "None" ? fields.paymentProvider : undefined,
  };
}

export function ArchitectureResolutionClient({
  projectId,
  projectName,
  blueprint,
  stackFields: initialStackFields,
  approved,
}: Props) {
  const router = useRouter();
  const [stackFields, setStackFields] = useState<StackFields>(initialStackFields);
  const [assumptions, setAssumptions] = useState<AssumptionEntry[]>(
    blueprint.assumptions.length > 0
      ? blueprint.assumptions
      : [
          {
            id: "ASM-001",
            statement: "Stack and integration choices match the wizard selections unless corrected below.",
            kind: "assumption",
            requiresValidation: false,
            source: "generated",
          },
        ]
  );
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);

  const environments = useMemo(() => {
    if (blueprint.deployment.environmentModel?.length) {
      return blueprint.deployment.environmentModel.map(
        (env) => `${env.name} — ${env.purpose}`
      );
    }
    return blueprint.deployment.environments;
  }, [blueprint.deployment]);

  function updateStackField(key: keyof StackFields, value: string) {
    setStackFields((prev) => ({ ...prev, [key]: value }));
  }

  function updateAssumption(index: number, statement: string) {
    setAssumptions((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, statement } : item
      )
    );
  }

  function addAssumption() {
    setAssumptions((prev) => [
      ...prev,
      {
        id: nextAssumptionId(prev),
        statement: "",
        kind: "assumption",
        requiresValidation: true,
        source: "user",
      },
    ]);
  }

  function removeAssumption(index: number) {
    setAssumptions((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  async function saveDraft() {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/architecture-resolution`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stack: stackPayload(stackFields),
          assumptions,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Save failed");
      }
      toast.success("Architecture model saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function approveAndGenerate() {
    if (!reviewConfirmed) {
      toast.error("Confirm you have reviewed the architecture model.");
      return;
    }

    setApproving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/architecture-resolution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stack: stackPayload(stackFields),
          assumptions,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Approval failed");
      }
      toast.success("Architecture approved — generating documents…");
      router.push(`/projects/${projectId}/documents`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Approval failed");
    } finally {
      setApproving(false);
    }
  }

  if (approved) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-4">
              Architecture model for {projectName} was approved on{" "}
              {blueprint.metadata.modelApprovedAt
                ? new Date(blueprint.metadata.modelApprovedAt).toLocaleString()
                : "record"}
              .
            </p>
            <Link href={`/projects/${projectId}/documents`}>
              <Button size="sm">View documents</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/dashboard" className="text-muted-foreground text-sm hover:text-foreground">
            Dashboard
          </Link>
          <span className="text-muted-foreground text-sm">/</span>
          <span className="text-sm font-medium text-foreground truncate max-w-48">{projectName}</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Architecture Resolution</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Review the interpreted canonical model before document generation starts.
        </p>
      </div>

      <div className="grid xl:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Classification</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {blueprint.classification.projectType ? (
                <Badge variant="outline">{blueprint.classification.projectType}</Badge>
              ) : null}
              {blueprint.classification.multiTenant ? (
                <Badge variant="outline">Multi-tenant</Badge>
              ) : null}
              {blueprint.classification.hasFileUpload ? (
                <Badge variant="outline">File uploads</Badge>
              ) : null}
              {blueprint.classification.hasAiAgents ? (
                <Badge variant="outline">AI agents</Badge>
              ) : null}
              {blueprint.classification.hasAsyncProcessing ? (
                <Badge variant="outline">Async processing</Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Stage: {blueprint.product.stage} · Security: {blueprint.product.securityRequirement}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Environments</h2>
            </div>
            <ul className="space-y-1">
              {environments.map((env) => (
                <li key={env} className="text-sm text-foreground">
                  {env}
                </li>
              ))}
            </ul>
            {blueprint.deployment.provider ? (
              <p className="text-xs text-muted-foreground">
                Provider: {blueprint.deployment.provider}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-4">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Technology stack</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Correct any misinterpreted stack choices before generating documents.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {(Object.keys(STACK_OPTIONS) as StackFieldKey[]).map((key) => {
              const formKey = STACK_FORM_KEYS[key];
              return (
                <div key={key} className="space-y-2">
                  <Label>{STACK_FIELD_LABELS[key]}</Label>
                  <Select
                    value={stackFields[formKey]}
                    onValueChange={(value) => value && updateStackField(formKey, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Select ${STACK_FIELD_LABELS[key].toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {STACK_OPTIONS[key].map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Plug className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Integrations</h2>
          </div>
          {blueprint.integrations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No integrations inferred yet.</p>
          ) : (
            <ul className="space-y-2">
              {blueprint.integrations.map((integration) => (
                <li
                  key={integration.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{integration.name}</p>
                    <p className="text-xs text-muted-foreground">{integration.purpose}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      integration.verified
                        ? "text-emerald-600 border-emerald-200"
                        : "text-amber-600 border-amber-200"
                    )}
                  >
                    {integration.verified ? "Verified" : "Review"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Assumptions</h2>
            </div>
            <Button variant="outline" size="sm" onClick={addAssumption}>
              Add assumption
            </Button>
          </div>
          <div className="space-y-3">
            {assumptions.map((assumption, index) => (
              <div key={assumption.id} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`assumption-${assumption.id}`}>{assumption.id}</Label>
                  {assumptions.length > 1 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => removeAssumption(index)}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
                <Textarea
                  id={`assumption-${assumption.id}`}
                  value={assumption.statement}
                  onChange={(event) => updateAssumption(index, event.target.value)}
                  rows={2}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={reviewConfirmed}
            onChange={(event) => setReviewConfirmed(event.target.checked)}
            className="mt-1"
          />
          <span className="text-sm text-foreground">
            I have reviewed the classification, stack, integrations, environments, and assumptions.
            Document generation may proceed.
          </span>
        </label>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={saveDraft} disabled={saving || approving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
          <Button onClick={approveAndGenerate} disabled={!reviewConfirmed || approving || saving}>
            {approving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Approving…
              </>
            ) : (
              "Approve & Generate Blueprint"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
