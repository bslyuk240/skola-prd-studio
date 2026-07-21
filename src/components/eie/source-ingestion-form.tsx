"use client";

import { useCallback, useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  detectSourceType,
  detectSourceTypeFromUrl,
  isGitHubUrl,
  isVideoUrl,
  VIDEO_URL_PATTERN,
} from "@/lib/eie/detector";
import type { EieSourceType } from "@/lib/eie/constants";
import { cn } from "@/lib/utils";
import { SourceProcessingProgress } from "@/components/eie/source-processing-progress";
import {
  type EieSourceListRow,
  useTrackedEieSource,
} from "@/components/eie/recent-sources-list";

type IngestMode = "note" | "video" | "document" | "github" | "file";
type UploadPhase = "idle" | "uploading" | "ingesting";

const MAX_FILE_SIZE = 52_428_800; // 50 MB

const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "text/markdown",
  "text/plain",
  "video/mp4",
  "video/webm",
  "audio/mp4",
  "audio/m4a",
].join(",");

const ACCEPTED_EXTENSIONS = ".pdf,.md,.markdown,.txt,.mp4,.webm,.m4a";

type ApiErrorBody = {
  success?: boolean;
  message?: string;
  details?: { field?: string; message?: string }[];
};

function parseApiError(data: ApiErrorBody, fallback: string): string {
  const detailMessage = data.details?.find((d) => d.message)?.message;
  if (detailMessage) return detailMessage;
  if (data.message && data.message !== "Request validation failed") return data.message;
  return fallback;
}

async function parseJsonResponse(res: Response): Promise<ApiErrorBody & { success?: boolean }> {
  try {
    return (await res.json()) as ApiErrorBody & { success?: boolean };
  } catch {
    return {};
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function resolveFileMimeType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "md" || ext === "markdown") return "text/markdown";
  if (ext === "txt") return "text/plain";
  if (ext === "pdf") return "application/pdf";
  if (ext === "mp4") return "video/mp4";
  if (ext === "webm") return "video/webm";
  if (ext === "m4a") return "audio/m4a";
  return "application/octet-stream";
}

function isAllowedFile(file: File): boolean {
  const mimeType = resolveFileMimeType(file);
  return ACCEPTED_FILE_TYPES.split(",").includes(mimeType);
}

async function ingestSource(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/eie/sources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await parseJsonResponse(res);
  if (!res.ok || !data.success) {
    throw new Error(parseApiError(data, "Ingestion failed"));
  }

  return (data as ApiErrorBody & { success: true; data: Record<string, unknown> }).data;
}

export function SourceIngestionForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<IngestMode>("note");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [content, setContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle");
  const [trackedSourceSeed, setTrackedSourceSeed] = useState<EieSourceListRow | null>(null);
  const trackedSource = useTrackedEieSource(trackedSourceSeed);

  const loading = uploadPhase !== "idle";

  const selectFile = useCallback(
    (file: File | null) => {
      if (!file) {
        setSelectedFile(null);
        return;
      }

      if (!isAllowedFile(file)) {
        toast.error("File type not allowed. Use PDF, Markdown, plain text, MP4, WebM, or M4A.");
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        toast.error("File exceeds the 50 MB upload limit.");
        return;
      }

      setSelectedFile(file);
      if (!name.trim()) {
        const baseName = file.name.replace(/\.[^.]+$/, "");
        setName(baseName.slice(0, 255));
      }
    },
    [name]
  );

  async function uploadAndIngestFile(file: File) {
    const mimeType = resolveFileMimeType(file);
    const sourceType = detectSourceType({
      kind: "file",
      filename: file.name,
      mimeType,
    }) as EieSourceType;

    const uploadRes = await fetch("/api/admin/eie/sources/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        mimeType,
        fileSize: file.size,
      }),
    });
    const uploadJson = await uploadRes.json();

    if (!uploadRes.ok || !uploadJson.success) {
      throw new Error(parseApiError(uploadJson, "Failed to prepare file upload"));
    }

    const { fileKey, uploadUrl } = uploadJson.data as {
      fileKey: string;
      uploadUrl: string;
    };

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": mimeType },
      body: file,
    });

    if (!putRes.ok) {
      throw new Error("File upload to storage failed. Check R2 CORS and credentials.");
    }

    setUploadPhase("ingesting");

    return ingestSource({
      sourceType,
      name: name.trim(),
      fileKey,
      metadata: {
        mimeType,
        fileSize: file.size,
      },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Enter a source name");
      return;
    }

    try {
      let createdSource: Record<string, unknown>;

      if (mode === "note") {
        if (content.trim().length < 20) {
          toast.error("Personal note must be at least 20 characters");
          return;
        }

        setUploadPhase("ingesting");
        createdSource = await ingestSource({ sourceType: "personal_note", name, content });
      } else if (mode === "github") {
        if (!url.trim()) {
          toast.error("Enter a GitHub repository URL");
          return;
        }
        if (!isGitHubUrl(url)) {
          toast.error("URL must be a GitHub repository link (github.com/org/repo).");
          return;
        }

        setUploadPhase("ingesting");
        createdSource = await ingestSource({ sourceType: "github_repo", name, sourceUrl: url });
      } else if (mode === "video") {
        if (!url.trim()) {
          toast.error("Enter a video URL");
          return;
        }
        if (!VIDEO_URL_PATTERN.test(url)) {
          toast.error(
            "Video URL must be YouTube, Vimeo, TikTok, Facebook, or Instagram."
          );
          return;
        }

        setUploadPhase("ingesting");
        createdSource = await ingestSource({ sourceType: "video_url", name, sourceUrl: url });
      } else if (mode === "document") {
        if (!url.trim()) {
          toast.error("Enter a document URL");
          return;
        }
        if (isVideoUrl(url)) {
          toast.error("Use the Video URL tab for video links.");
          return;
        }
        if (isGitHubUrl(url)) {
          toast.error("Use the GitHub Repo tab for repository links.");
          return;
        }

        const sourceType = detectSourceTypeFromUrl(url) ?? "official_doc";
        setUploadPhase("ingesting");
        createdSource = await ingestSource({ sourceType, name, sourceUrl: url });
      } else {
        if (!selectedFile) {
          toast.error("Select a file to upload");
          return;
        }
        setUploadPhase("uploading");
        createdSource = await uploadAndIngestFile(selectedFile);
      }

      setTrackedSourceSeed({
        id: String(createdSource.id),
        name: String(createdSource.name),
        sourceType: String(createdSource.sourceType),
        status: String(createdSource.status ?? "pending"),
        errorMessage: createdSource.errorMessage ? String(createdSource.errorMessage) : null,
        sourceUrl: createdSource.sourceUrl ? String(createdSource.sourceUrl) : null,
        metadata: createdSource.metadata,
      });

      toast.success("Ingestion started. Progress updates automatically.");
      setName("");
      setUrl("");
      setContent("");
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      if (error instanceof TypeError) {
        toast.error("Network error — check your connection and try again.");
        return;
      }
      toast.error(error instanceof Error ? error.message : "Ingestion failed");
    } finally {
      setUploadPhase("idle");
    }
  }

  function handleDrop(e: React.DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files.item(0);
    if (file) selectFile(file);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs value={mode} onValueChange={(v) => setMode(v as IngestMode)}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="note">Personal Note</TabsTrigger>
          <TabsTrigger value="video">Video URL</TabsTrigger>
          <TabsTrigger value="document">Document URL</TabsTrigger>
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

          <TabsContent value="video" className="space-y-2">
            <Label htmlFor="video-url">Video URL</Label>
            <Input
              id="video-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
            />
            <p className="text-xs text-muted-foreground">
              Supports YouTube (captions), Vimeo, TikTok, Facebook, and Instagram.
              Facebook and Instagram often block server-side access — use File Upload or Personal Note when they fail.
            </p>
          </TabsContent>

          <TabsContent value="document" className="space-y-2">
            <Label htmlFor="document-url">Document or web page URL</Label>
            <Input
              id="document-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/docs/architecture.md"
            />
            <p className="text-xs text-muted-foreground">
              Supports public web pages, PDF links, markdown files, and research paper URLs.
              Source type is detected automatically from the URL.
            </p>
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

          <TabsContent value="file" className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept={`${ACCEPTED_FILE_TYPES},${ACCEPTED_EXTENSIONS}`}
              className="sr-only"
              onChange={(e) => selectFile(e.target.files?.item(0) ?? null)}
            />

            {!selectedFile ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                }}
                onDrop={handleDrop}
                className={cn(
                  "flex w-full flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center transition-colors",
                  dragActive
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-muted/40"
                )}
              >
                <Upload className="mb-2 h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Choose file or drag here</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  PDF, Markdown, plain text, MP4, WebM, or M4A — up to 50 MB
                </p>
              </button>
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(selectedFile.size)} · {resolveFileMimeType(selectedFile)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  disabled={loading}
                  aria-label="Remove selected file"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Text and PDF files are parsed directly. Video and audio files are transcribed with Whisper.
            </p>
          </TabsContent>
        </div>
      </Tabs>

      {trackedSource ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{trackedSource.name}</p>
              <p className="text-xs capitalize text-muted-foreground">
                {trackedSource.sourceType.replace(/_/g, " ")}
              </p>
            </div>
            <p className="text-xs capitalize text-muted-foreground">{trackedSource.status}</p>
          </div>
          <SourceProcessingProgress
            status={trackedSource.status}
            metadata={trackedSource.metadata}
          />
          {trackedSource.status === "failed" && trackedSource.errorMessage ? (
            <p className="mt-2 text-xs text-red-600">{trackedSource.errorMessage}</p>
          ) : null}
          {trackedSource.status === "success" ? (
            <p className="mt-2 text-xs text-emerald-600">
              Processing finished. Open Review to approve extracted concepts.
            </p>
          ) : null}
        </div>
      ) : null}

      <Button type="submit" disabled={loading} className="gap-1.5">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {uploadPhase === "uploading"
          ? "Uploading File"
          : uploadPhase === "ingesting"
            ? "Starting Ingestion"
            : "Ingest Source"}
      </Button>
    </form>
  );
}
