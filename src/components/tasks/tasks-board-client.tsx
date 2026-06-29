"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import type { Project, BuildTask } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Wand2, Loader2, ClipboardList } from "lucide-react";
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
}

export function TasksBoardClient({ project, tasks: initialTasks }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [generating, setGenerating] = useState(false);

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
                    <TaskCard key={task.id} task={task} onStatusChange={updateStatus} />
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

function TaskCard({ task, onStatusChange }: { task: BuildTask; onStatusChange: (id: string, status: string) => void }) {
  const priorityCfg = PRIORITY_CONFIG[task.priority ?? "medium"];

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
      <p className="text-xs font-semibold text-foreground mb-1.5 leading-tight">{task.title}</p>
      {task.phase && <p className="text-xs text-muted-foreground mb-2">{task.phase}</p>}
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        <Badge variant="outline" className={cn("text-xs py-0", priorityCfg.className)}>
          {priorityCfg.label}
        </Badge>
      </div>
      {task.estimatedEffort && (
        <p className="text-xs text-muted-foreground mb-2">{task.estimatedEffort}</p>
      )}
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
    </div>
  );
}
