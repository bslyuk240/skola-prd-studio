"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Project, Document } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, CheckCircle, ArrowLeft, Copy } from "lucide-react";

interface Props {
  project: Project;
  document: Document;
}

export function DocumentViewer({ project, document: doc }: Props) {
  const router = useRouter();
  const [regenerating, setRegenerating] = useState(false);
  const [approving, setApproving] = useState(false);

  async function regenerate() {
    setRegenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, documentType: doc.type }),
      });
      if (!res.ok) throw new Error();
      toast.success("Document regenerated!");
      router.refresh();
    } catch {
      toast.error("Regeneration failed.");
    } finally {
      setRegenerating(false);
    }
  }

  async function approve() {
    setApproving(true);
    try {
      await fetch(`/api/projects/${project.id}/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      toast.success("Document approved!");
      router.refresh();
    } catch {
      toast.error("Failed to approve.");
    } finally {
      setApproving(false);
    }
  }

  function copyContent() {
    navigator.clipboard.writeText(doc.content ?? "");
    toast.success("Copied to clipboard!");
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Toolbar */}
      <div className="border-b border-border bg-background px-6 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <Link href={`/projects/${project.id}/documents`}>
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          </Link>
          <div className="h-4 w-px bg-border" />
          <div>
            <p className="text-xs text-muted-foreground">{project.name}</p>
            <h1 className="text-sm font-semibold text-foreground">{doc.title}</h1>
          </div>
          <Badge variant="outline" className="capitalize text-xs">{doc.status}</Badge>
          {doc.wordCount ? (
            <span className="text-xs text-muted-foreground">{doc.wordCount.toLocaleString()} words</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={copyContent}>
            <Copy className="w-3.5 h-3.5" /> Copy
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={regenerate} disabled={regenerating}>
            {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Regenerate
          </Button>
          {doc.status !== "approved" && (
            <Button size="sm" className="gap-1.5" onClick={approve} disabled={approving}>
              {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              Approve
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-10 py-10">
          {doc.content ? (
            <MarkdownRenderer content={doc.content} />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <p className="text-muted-foreground text-sm mb-4">This document has not been generated yet.</p>
              <Button onClick={regenerate} disabled={regenerating} className="gap-2">
                {regenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Generate Document
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("# ")) {
      elements.push(<h1 key={i} className="text-2xl font-bold mt-8 mb-4 text-foreground first:mt-0">{line.slice(2)}</h1>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="text-xl font-bold mt-6 mb-3 text-foreground">{line.slice(3)}</h2>);
    } else if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="text-base font-semibold mt-4 mb-2 text-foreground">{line.slice(4)}</h3>);
    } else if (line.startsWith("#### ")) {
      elements.push(<h4 key={i} className="text-sm font-semibold mt-3 mb-1.5 text-foreground">{line.slice(5)}</h4>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc list-inside space-y-1 mb-3 text-sm text-foreground/90">
          {items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
        </ul>
      );
      continue;
    } else if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="list-decimal list-inside space-y-1 mb-3 text-sm text-foreground/90">
          {items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
        </ol>
      );
      continue;
    } else if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={`pre-${i}`} className="bg-muted rounded-lg p-4 overflow-x-auto mb-4 text-xs font-mono">
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
    } else if (line.startsWith("---")) {
      elements.push(<hr key={i} className="border-border my-4" />);
    } else if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      elements.push(<TableRenderer key={`table-${i}`} lines={tableLines} />);
      continue;
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="mb-2" />);
    } else {
      elements.push(<p key={i} className="text-sm text-foreground/90 mb-3 leading-relaxed">{renderInline(line)}</p>);
    }
    i++;
  }

  return <>{elements}</>;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

function TableRenderer({ lines }: { lines: string[] }) {
  const rows = lines.map((l) =>
    l.split("|").filter((_, i, arr) => i > 0 && i < arr.length - 1).map((c) => c.trim())
  );
  const header = rows[0];
  const body = rows.slice(2);

  return (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-muted">
            {header?.map((h, i) => (
              <th key={i} className="border border-border px-3 py-2 text-left font-semibold text-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} className="even:bg-muted/30">
              {row.map((cell, ci) => (
                <td key={ci} className="border border-border px-3 py-2 text-foreground/80">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
