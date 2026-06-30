"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Project, BuildTask, AgentLog, AgentQuestion } from "@/db/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Bot, Code2, GitBranch, Zap, Plus, Loader2, Copy,
  Trash2, CheckCircle2, MessageCircleQuestion, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

const AGENT_TYPES = [
  { id: "cursor", label: "Cursor", icon: Code2 },
  { id: "windsurf", label: "Windsurf", icon: Zap },
  { id: "claude_code", label: "Claude Code", icon: Bot },
  { id: "copilot", label: "GitHub Copilot", icon: GitBranch },
  { id: "other", label: "Other (Generic MCP)", icon: Bot },
] as const;

const EVENT_LABELS: Record<string, string> = {
  task_claimed: "Task claimed",
  task_started: "Task started",
  progress_update: "Progress update",
  files_changed: "Files changed",
  tests_passed: "Tests passed",
  tests_failed: "Tests failed",
  blocked: "Blocked",
  completed: "Reported complete",
  needs_review: "Needs review",
  question_asked: "Question asked",
};

interface ConnectionRow {
  id: string;
  agentType: string;
  connectionName: string;
  status: string | null;
  createdAt: Date;
  revokedAt: Date | null;
}

interface Props {
  project: Project;
  tasks: BuildTask[];
  connections: ConnectionRow[];
  recentEvents: AgentLog[];
  pendingQuestions: AgentQuestion[];
}

export function AgentHandoffClient({ project, tasks, connections: initialConnections, recentEvents, pendingQuestions }: Props) {
  const router = useRouter();
  const [connections, setConnections] = useState(initialConnections);
  const [showNewForm, setShowNewForm] = useState(false);
  const [connectionName, setConnectionName] = useState("");
  const [agentType, setAgentType] = useState<typeof AGENT_TYPES[number]["id"]>("cursor");
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<{ plainTextToken: string; mcpConfigSample: object } | null>(null);
  const [answering, setAnswering] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");

  const approvedCount = tasks.filter((t) => t.isApprovedForAgent).length;
  const claimedCount = tasks.filter((t) => t.assignedConnectionId).length;
  const reviewCount = tasks.filter((t) => t.status === "review").length;

  async function createConnection() {
    if (connectionName.trim().length < 3) {
      toast.error("Connection name must be at least 3 characters.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/agent/connections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionName, agentType }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setNewToken({ plainTextToken: data.plainTextToken, mcpConfigSample: data.mcpConfigSample });
      setShowNewForm(false);
      setConnectionName("");
      router.refresh();
      setConnections((prev) => [...prev, {
        id: data.id, agentType, connectionName: data.connectionName,
        status: "active", createdAt: new Date(), revokedAt: null,
      }]);
    } catch {
      toast.error("Failed to create connection.");
    } finally {
      setCreating(false);
    }
  }

  async function revokeConnection(id: string) {
    setRevoking(id);
    try {
      await fetch(`/api/projects/${project.id}/agent/connections/${id}`, { method: "DELETE" });
      setConnections((prev) => prev.map((c) => (c.id === id ? { ...c, status: "revoked", revokedAt: new Date() } : c)));
      toast.success("Connection revoked.");
    } catch {
      toast.error("Failed to revoke connection.");
    } finally {
      setRevoking(null);
    }
  }

  async function submitAnswer(questionId: string) {
    if (!answerText.trim()) return;
    try {
      await fetch(`/api/projects/${project.id}/agent/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: answerText }),
      });
      toast.success("Answer sent.");
      setAnswering(null);
      setAnswerText("");
      router.refresh();
    } catch {
      toast.error("Failed to send answer.");
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <Link href={`/projects/${project.id}/documents`}>
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 mb-1">
              <ArrowLeft className="w-4 h-4" /> Documents
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Agent Handoff</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Send approved build tasks from {project.name} to your IDE agent, and track progress back here.
          </p>
        </div>
        <Button onClick={() => setShowNewForm(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Connection
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Tasks", value: tasks.length },
          { label: "Approved for Agent", value: approvedCount },
          { label: "Claimed / In Progress", value: claimedCount },
          { label: "Awaiting Your Review", value: reviewCount },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{label}</p>
              <p className="text-3xl font-bold text-foreground">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid xl:grid-cols-3 gap-6">
        {/* Connections */}
        <div className="xl:col-span-2 space-y-4">
          <h2 className="text-base font-semibold text-foreground">Connections</h2>
          {connections.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-10 text-center">
                <Bot className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="font-semibold text-foreground mb-1">No agents connected yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Generate a connection to let Cursor, Windsurf, or Claude Code pull approved tasks via MCP.
                </p>
                <Button size="sm" onClick={() => setShowNewForm(true)} className="gap-2">
                  <Plus className="w-4 h-4" /> New Connection
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {connections.map((c) => {
                const meta = AGENT_TYPES.find((a) => a.id === c.agentType) ?? AGENT_TYPES[4];
                const Icon = meta.icon;
                const active = c.status === "active";
                return (
                  <Card key={c.id}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">{c.connectionName}</p>
                          <Badge variant="outline" className={cn("text-xs", active ? "text-emerald-600 border-emerald-200 bg-emerald-50" : "text-muted-foreground")}>
                            {active ? "Active" : "Revoked"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{meta.label}</p>
                      </div>
                      {active && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 text-red-600 hover:text-red-700"
                          onClick={() => revokeConnection(c.id)}
                          disabled={revoking === c.id}
                        >
                          {revoking === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          Revoke
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Pending questions */}
          {pendingQuestions.length > 0 && (
            <>
              <h2 className="text-base font-semibold text-foreground pt-4">Questions From Your Agent</h2>
              <div className="space-y-2">
                {pendingQuestions.map((q) => (
                  <Card key={q.id} className="border-amber-200">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2 mb-2">
                        <MessageCircleQuestion className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-sm text-foreground">{q.question}</p>
                      </div>
                      {answering === q.id ? (
                        <div className="space-y-2 mt-2">
                          <Textarea
                            value={answerText}
                            onChange={(e) => setAnswerText(e.target.value)}
                            placeholder="Your answer…"
                            className="text-sm"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => submitAnswer(q.id)}>Send Answer</Button>
                            <Button size="sm" variant="ghost" onClick={() => setAnswering(null)}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => { setAnswering(q.id); setAnswerText(""); }}>
                          Answer
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Activity timeline */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4" /> Recent Activity
          </h2>
          <Card>
            <CardContent className="p-4">
              {recentEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No agent activity yet.</p>
              ) : (
                <div className="space-y-3">
                  {recentEvents.map((e) => (
                    <div key={e.id} className="border-l-2 border-border pl-3">
                      <p className="text-xs font-semibold text-foreground">{EVENT_LABELS[e.eventType] ?? e.eventType}</p>
                      {e.message && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{e.message}</p>}
                      <p className="text-xs text-muted-foreground/60 mt-0.5">{new Date(e.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Link href={`/projects/${project.id}/tasks`}>
            <Button variant="outline" size="sm" className="w-full gap-2">
              View Build Tasks →
            </Button>
          </Link>
        </div>
      </div>

      {/* New connection dialog */}
      <Dialog open={showNewForm} onOpenChange={setShowNewForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Agent Connection</DialogTitle>
            <DialogDescription>Generates a scoped API token your IDE agent uses to connect to this project.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="conn-name">Connection name</Label>
              <Input id="conn-name" value={connectionName} onChange={(e) => setConnectionName(e.target.value)} placeholder="Dev MacBook — Cursor" />
            </div>
            <div className="space-y-1.5">
              <Label>Agent type</Label>
              <div className="grid grid-cols-2 gap-2">
                {AGENT_TYPES.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setAgentType(id)}
                    className={cn(
                      "flex items-center gap-2 border rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      agentType === id ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewForm(false)}>Cancel</Button>
            <Button onClick={createConnection} disabled={creating} className="gap-2">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Connection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Token reveal — shown once */}
      <Dialog open={!!newToken} onOpenChange={(open) => !open && setNewToken(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Connection Created
            </DialogTitle>
            <DialogDescription>
              Copy this token now — it will not be shown again. Add it to your IDE&apos;s MCP configuration.
            </DialogDescription>
          </DialogHeader>
          {newToken && (
            <div className="space-y-3 min-w-0">
              <div className="min-w-0">
                <Label className="text-xs">API Token</Label>
                <div className="flex items-center gap-2 mt-1 min-w-0">
                  <code className="flex-1 min-w-0 bg-muted rounded-lg px-3 py-2 text-xs font-mono break-all">{newToken.plainTextToken}</code>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => { navigator.clipboard.writeText(newToken.plainTextToken); toast.success("Token copied!"); }}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="min-w-0">
                <Label className="text-xs">MCP Config (mcp.json)</Label>
                <div className="flex items-start gap-2 mt-1 min-w-0">
                  <pre className="flex-1 min-w-0 bg-muted rounded-lg px-3 py-2 text-xs font-mono whitespace-pre-wrap break-all">
                    {JSON.stringify(newToken.mcpConfigSample, null, 2)}
                  </pre>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => { navigator.clipboard.writeText(JSON.stringify(newToken.mcpConfigSample, null, 2)); toast.success("Config copied!"); }}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setNewToken(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
