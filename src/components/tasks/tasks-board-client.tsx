"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import type { Project, BuildTask, AgentLog, AgentQuestion } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Wand2, Loader2, ClipboardList, Copy, CheckCircle2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

const COLUMNS = [
  { status: "backlog", label: "Backlog", color: "text-muted-foreground", bg: "bg-muted/40" },
  { status: "ready", label: "Ready", color: "text-blue-600", bg: "bg-blue-50" },
  { status: "in_progress", label: "In Progress", color: "text-amber-600", bg: "bg-amber-50" },
  { status: "review", label: "Review", color: "text-violet-600", bg: "bg-violet-50" },
  { status: "done", label: "Done", color: "text-emerald-600", bg: "bg-emerald-50" },
  { status: "blocked", label: "Blocked", color: "text-red-600", bg: "bg-red-50" },
] as const;

const PRIORITY_CONFIG = {
  low: { label: "Low", className: "bg-muted text-muted-foreground" },
  medium: { label: "Medium", className: "bg-blue-100 text-blue-700" },
  high: { label: "High", className: "bg-amber-100 text-amber-700" },
  critical: { label: "Critical", className: "bg-red-100 text-red-700" },
};

interface Props {
  project: Project;
  tasks: BuildTask[];
  reportsByTask: Record<string, AgentLog>;
  questionsByTask: Record<string, AgentQuestion[]>;
  connectionNameById: Record<string, string>;
}

export function TasksBoardClient({ project, tasks: initialTasks, reportsByTask, questionsByTask, connectionNameById }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [generating, setGenerating] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  async function generateTasks() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/tasks/generate`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("Tasks generated from Implementation Plan!");
      router.refresh();
    } catch {
      toast.error("Failed to generate tasks. Generate the Implementation Plan first.");
    } finally {
      setGenerating(false);
    }
  }

  async function updateStatus(taskId: string, status: string) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: status as BuildTask["status"] } : t)));
    await fetch(`/api/projects/${project.id}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function approveForAgent(taskId: string) {
    setBusyTaskId(taskId);
    try {
      const res = await fetch(`/api/projects/${project.id}/tasks/${taskId}/handoff`, { method: "POST" });
      if (!res.ok) throw new Error();
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, isApprovedForAgent: true, status: t.status === "backlog" ? "ready" : t.status } : t)));
      toast.success("Task approved for agent handoff.");
    } catch {
      toast.error("Failed to approve task.");
    } finally {
      setBusyTaskId(null);
    }
  }

  async function copyTaskPacket(taskId: string) {
    setBusyTaskId(taskId);
    try {
      const res = await fetch(`/api/projects/${project.id}/tasks/${taskId}/handoff`);
      if (!res.ok) throw new Error();
      const packet = await res.json();
      await navigator.clipboard.writeText(packet.formattedManualPrompt);
      toast.success("Task packet copied — paste into your IDE agent.");
    } catch {
      toast.error("Failed to build task packet.");
    } finally {
      setBusyTaskId(null);
    }
  }

  async function reviewTask(taskId: string, decision: "approved" | "reject_revision") {
    setBusyTaskId(taskId);
    try {
      const res = await fetch(`/api/projects/${project.id}/tasks/${taskId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: data.newStatus } : t)));
      toast.success(decision === "approved" ? "Task approved and marked Done." : "Sent back to In Progress.");
    } catch {
      toast.error("Failed to record review decision.");
    } finally {
      setBusyTaskId(null);
    }
  }

  const byStatus = (status: string) => tasks.filter((t) => t.status === status);

  return (
    <div className="p-8 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href={`/projects/${project.id}/documents`}>
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 mb-1">
              <ArrowLeft className="w-4 h-4" /> Documents
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Build Tasks</h1>
          <p className="text-muted-foreground text-sm">{project.name} — {tasks.length} tasks</p>
        </div>
        <Button onClick={generateTasks} disabled={generating} variant="outline" className="gap-2">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          Generate from Plan
        </Button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-6 text-sm">
        {COLUMNS.map(({ status, label, color }) => {
          const count = byStatus(status).length;
          return (
            <div key={status} className="flex items-center gap-1.5">
              <span className={cn("font-bold", color)}>{count}</span>
              <span className="text-muted-foreground">{label}</span>
            </div>
          );
        })}
      </div>

      {tasks.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl p-16 text-center">
          <ClipboardList className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-foreground mb-2">No tasks yet</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Tasks are generated from your Implementation Plan. Generate that document first, then come back here.
          </p>
          <Button onClick={generateTasks} disabled={generating} className="gap-2">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            Generate Tasks
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-3 xl:grid-cols-6 gap-4">
          {COLUMNS.map(({ status, label, color, bg }) => {
            const colTasks = byStatus(status);
            return (
              <div key={status} className="flex flex-col gap-2">
                <div className={cn("flex items-center gap-1.5 px-2 py-1.5 rounded-lg", bg)}>
                  <span className={cn("text-xs font-semibold", color)}>{label}</span>
                  <span className={cn("text-xs ml-auto font-bold", color)}>{colTasks.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      report={reportsByTask[task.id]}
                      questions={questionsByTask[task.id] ?? []}
                      claimedByName={task.assignedConnectionId ? connectionNameById[task.assignedConnectionId] : undefined}
                      busy={busyTaskId === task.id}
                      onStatusChange={updateStatus}
                      onApproveForAgent={approveForAgent}
                      onCopyPacket={copyTaskPacket}
                      onReview={reviewTask}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface TaskCardProps {
  task: BuildTask;
  report?: AgentLog;
  questions: AgentQuestion[];
  claimedByName?: string;
  busy: boolean;
  onStatusChange: (id: string, status: string) => void;
  onApproveForAgent: (id: string) => void;
  onCopyPacket: (id: string) => void;
  onReview: (id: string, decision: "approved" | "reject_revision") => void;
}

function TaskCard({ task, report, questions, claimedByName, busy, onStatusChange, onApproveForAgent, onCopyPacket, onReview }: TaskCardProps) {
  const priorityCfg = PRIORITY_CONFIG[task.priority ?? "medium"];
  const filesChanged = (report?.filesChanged as { filePath: string; riskLevel: string }[] | null) ?? [];
  const testResults = (report?.testResult as { command: string; status: string }[] | null) ?? [];
  const openQuestions = questions.filter((q) => q.status === "pending");

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
      <p className="text-xs font-semibold text-foreground mb-1.5 leading-tight">{task.title}</p>
      {task.phase && <p className="text-xs text-muted-foreground mb-2">{task.phase}</p>}
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        <Badge variant="outline" className={cn("text-xs py-0", priorityCfg.className)}>
          {priorityCfg.label}
        </Badge>
        {task.isApprovedForAgent && (
          <Badge variant="outline" className="text-xs py-0 text-primary border-primary/30 bg-primary/5">
            Approved for Agent
          </Badge>
        )}
        {claimedByName && (
          <Badge variant="outline" className="text-xs py-0 text-blue-600 border-blue-200 bg-blue-50">
            Claimed by {claimedByName}
          </Badge>
        )}
        {openQuestions.length > 0 && (
          <Badge variant="outline" className="text-xs py-0 text-amber-600 border-amber-200 bg-amber-50">
            {openQuestions.length} question{openQuestions.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>
      {task.estimatedEffort && (
        <p className="text-xs text-muted-foreground mb-2">{task.estimatedEffort}</p>
      )}

      {/* Agent report — only on tasks awaiting human review */}
      {task.status === "review" && report && (
        <div className="bg-muted/60 rounded-md p-2 mb-2 space-y-1.5">
          <p className="text-xs text-foreground leading-relaxed line-clamp-3">{report.message}</p>
          {filesChanged.length > 0 && (
            <p className="text-xs text-muted-foreground">{filesChanged.length} file{filesChanged.length > 1 ? "s" : ""} changed</p>
          )}
          {testResults.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Tests: {testResults.filter((t) => t.status === "passed").length}/{testResults.length} passed
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2 flex-wrap mb-1.5">
        {(task.status === "backlog" || task.status === "ready") && !task.isApprovedForAgent && (
          <button onClick={() => onApproveForAgent(task.id)} disabled={busy} className="text-xs text-primary hover:underline disabled:opacity-50">
            Approve for Agent
          </button>
        )}
        <button onClick={() => onCopyPacket(task.id)} disabled={busy} className="text-xs text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50 inline-flex items-center gap-1">
          <Copy className="w-3 h-3" /> Copy Task Packet
        </button>
      </div>

      {task.status === "review" ? (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => onReview(task.id, "approved")} disabled={busy} className="text-xs text-emerald-600 hover:underline disabled:opacity-50 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Approve & Done
          </button>
          <button onClick={() => onReview(task.id, "reject_revision")} disabled={busy} className="text-xs text-amber-600 hover:underline disabled:opacity-50 inline-flex items-center gap-1">
            <Undo2 className="w-3 h-3" /> Send Back
          </button>
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap">
          {task.status !== "in_progress" && (
            <button onClick={() => onStatusChange(task.id, "in_progress")} className="text-xs text-amber-600 hover:underline">Start</button>
          )}
          {task.status !== "done" && (
            <button onClick={() => onStatusChange(task.id, "done")} className="text-xs text-emerald-600 hover:underline">Done</button>
          )}
          {task.status !== "blocked" && (
            <button onClick={() => onStatusChange(task.id, "blocked")} className="text-xs text-red-500 hover:underline">Block</button>
          )}
        </div>
      )}
    </div>
  );
}
