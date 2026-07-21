"use client";

import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type IngestMode = "note" | "url" | "github" | "file";

export function SourceIngestionForm() {
  const [mode, setMode] = useState<IngestMode>("note");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Enter a source name");
      return;
    }

    setLoading(true);
    try {
      let body: Record<string, unknown>;

      if (mode === "note") {
        if (content.trim().length < 20) {
          toast.error("Personal note must be at least 20 characters");
          return;
        }
        body = { sourceType: "personal_note", name, content };
      } else if (mode === "github") {
        body = { sourceType: "github_repo", name, sourceUrl: url };
      } else if (mode === "url") {
        body = { sourceType: "video_url", name, sourceUrl: url };
      } else {
        toast.error("File upload requires storage configuration. Use Personal Note or URL for now.");
        return;
      }

      const res = await fetch("/api/admin/eie/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message ?? "Ingestion failed");
      }

      toast.success("Ingestion started. Processing runs in the background.");
      setName("");
      setUrl("");
      setContent("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ingestion failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs value={mode} onValueChange={(v) => setMode(v as IngestMode)}>
        <TabsList>
          <TabsTrigger value="note">Personal Note</TabsTrigger>
          <TabsTrigger value="url">Video URL</TabsTrigger>
          <TabsTrigger value="github">GitHub Repo</TabsTrigger>
          <TabsTrigger value="file">File Upload</TabsTrigger>
        </TabsList>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="source-name">Source name</Label>
            <Input
              id="source-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="OAuth 2.1 implementation guide"
            />
          </div>

          <TabsContent value="note" className="space-y-2">
            <Label htmlFor="source-content">Markdown or text content</Label>
            <Textarea
              id="source-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              placeholder="Paste engineering notes, standards, or markdown..."
            />
          </TabsContent>

          <TabsContent value="url" className="space-y-2">
            <Label htmlFor="video-url">YouTube or Vimeo URL</Label>
            <Input
              id="video-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </TabsContent>

          <TabsContent value="github" className="space-y-2">
            <Label htmlFor="github-url">GitHub repository URL</Label>
            <Input
              id="github-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/org/repo"
            />
          </TabsContent>

          <TabsContent value="file">
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center">
              <Upload className="mb-2 h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                File upload uses signed storage URLs. Configure EIE storage env vars, then use
                the upload API before submitting a file-backed source.
              </p>
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <Button type="submit" disabled={loading} className="gap-1.5">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Ingest Source
      </Button>
    </form>
  );
}
