"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EIE_CATEGORIES } from "@/lib/eie/constants";

export type DraftFormState = {
  conceptName: string;
  category: string;
  summary: string;
  practicalExplanation: string;
  bestPractices: string;
  tradeOffs: string;
  alternativeApproaches: string;
  securityConsiderations: string;
  commonMistakes: string;
  implementationRecommendations: string;
};

function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

type SynthesisComparisonViewProps = {
  draftId: string;
  rawContent: string;
  initial: DraftFormState;
  onSaved?: () => void;
};

export function SynthesisComparisonView({
  draftId,
  rawContent,
  initial,
  onSaved,
}: SynthesisComparisonViewProps) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  function updateField<K extends keyof DraftFormState>(key: K, value: DraftFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/eie/drafts/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conceptName: form.conceptName,
          category: form.category,
          summary: form.summary,
          practicalExplanation: form.practicalExplanation,
          bestPractices: linesToArray(form.bestPractices),
          tradeOffs: linesToArray(form.tradeOffs),
          alternativeApproaches: linesToArray(form.alternativeApproaches),
          securityConsiderations: linesToArray(form.securityConsiderations),
          commonMistakes: linesToArray(form.commonMistakes),
          implementationRecommendations: {
            recommendations: linesToArray(form.implementationRecommendations),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Save failed");
      toast.success("Draft saved");
      onSaved?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-2">
        <h2 className="text-base font-semibold">Extracted source</h2>
        <div className="max-h-[640px] overflow-y-auto rounded-lg border border-border bg-muted/30 p-4">
          <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{rawContent || "No raw content available yet."}</pre>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-base font-semibold">Synthesis draft</h2>

        <div className="space-y-2">
          <Label htmlFor="concept-name">Concept name</Label>
          <Input
            id="concept-name"
            value={form.conceptName}
            onChange={(e) => updateField("conceptName", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            value={form.category}
            onChange={(e) => updateField("category", e.target.value)}
            className="flex h-8 w-full rounded-lg border border-border bg-background px-2 text-sm"
          >
            {EIE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="summary">Summary</Label>
          <Textarea id="summary" rows={3} value={form.summary} onChange={(e) => updateField("summary", e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="explanation">Practical explanation</Label>
          <Textarea id="explanation" rows={4} value={form.practicalExplanation} onChange={(e) => updateField("practicalExplanation", e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="best-practices">Best practices (one per line)</Label>
          <Textarea id="best-practices" rows={4} value={form.bestPractices} onChange={(e) => updateField("bestPractices", e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="trade-offs">Trade-offs (one per line)</Label>
          <Textarea id="trade-offs" rows={3} value={form.tradeOffs} onChange={(e) => updateField("tradeOffs", e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="alternatives">Alternative approaches (one per line)</Label>
          <Textarea id="alternatives" rows={3} value={form.alternativeApproaches} onChange={(e) => updateField("alternativeApproaches", e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="security">Security considerations (one per line)</Label>
          <Textarea id="security" rows={3} value={form.securityConsiderations} onChange={(e) => updateField("securityConsiderations", e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mistakes">Common mistakes (one per line)</Label>
          <Textarea id="mistakes" rows={3} value={form.commonMistakes} onChange={(e) => updateField("commonMistakes", e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="implementation">Implementation recommendations (one per line)</Label>
          <Textarea id="implementation" rows={4} value={form.implementationRecommendations} onChange={(e) => updateField("implementationRecommendations", e.target.value)} />
        </div>

        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save Draft
        </Button>
      </div>
    </div>
  );
}

export function draftToFormState(draft: {
  conceptName: string;
  category: string;
  summary: string;
  practicalExplanation: string;
  bestPractices: unknown;
  tradeOffs: unknown;
  alternativeApproaches: unknown;
  securityConsiderations: unknown;
  commonMistakes: unknown;
  implementationRecommendations: unknown;
}): DraftFormState {
  const asLines = (value: unknown) =>
    Array.isArray(value) ? value.map(String).join("\n") : String(value ?? "");

  return {
    conceptName: draft.conceptName,
    category: draft.category,
    summary: draft.summary,
    practicalExplanation: draft.practicalExplanation,
    bestPractices: asLines(draft.bestPractices),
    tradeOffs: asLines(draft.tradeOffs),
    alternativeApproaches: asLines(draft.alternativeApproaches),
    securityConsiderations: asLines(draft.securityConsiderations),
    commonMistakes: asLines(draft.commonMistakes),
    implementationRecommendations: asLines(
      typeof draft.implementationRecommendations === "object" &&
        draft.implementationRecommendations &&
        "recommendations" in (draft.implementationRecommendations as object)
        ? (draft.implementationRecommendations as { recommendations: string[] }).recommendations
        : draft.implementationRecommendations
    ),
  };
}
