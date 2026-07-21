"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DraftReviewActionsProps = {
  draftId: string;
  conceptName: string;
};

export function DraftReviewActions({ draftId, conceptName }: DraftReviewActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<"publish" | "reject" | null>(null);
  const [slug, setSlug] = useState(
    conceptName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );

  async function handleReject() {
    setLoading("reject");
    try {
      const res = await fetch(`/api/admin/eie/drafts/${draftId}/reject`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Reject failed");
      toast.success("Draft rejected");
      router.push("/admin/eie/review");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reject failed");
    } finally {
      setLoading(null);
    }
  }

  async function handlePublish() {
    setLoading("publish");
    try {
      const res = await fetch(`/api/admin/eie/drafts/${draftId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Publish failed");
      toast.success("Concept published to Learning Hub");
      router.push("/admin/eie/review");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Publish failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2 sm:max-w-sm">
        <Label htmlFor="publish-slug">Publish slug</Label>
        <Input id="publish-slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button variant="destructive" onClick={handleReject} disabled={loading !== null}>
          {loading === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Reject Draft
        </Button>
        <Button onClick={handlePublish} disabled={loading !== null} className="gap-1.5">
          {loading === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Publish Concept
        </Button>
      </div>
    </div>
  );
}
