import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects, buildTasks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Bot, Code2, GitBranch, ArrowLeft, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const AGENT_TYPES = [
  { id: "cursor", name: "Cursor", icon: Code2, desc: "AI-powered code editor", status: "coming_soon" },
  { id: "windsurf", name: "Windsurf", icon: Zap, desc: "Codeium's AI IDE", status: "coming_soon" },
  { id: "claude_code", name: "Claude Code", icon: Bot, desc: "Anthropic's coding agent", status: "coming_soon" },
  { id: "github", name: "GitHub Copilot", icon: GitBranch, desc: "GitHub's AI assistant", status: "coming_soon" },
];

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function AgentPage({ params }: Props) {
  const { projectId } = await params;
  const { userId } = await auth();
  if (!userId) return null;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  if (!project) notFound();

  const tasks = await db.select().from(buildTasks).where(eq(buildTasks.projectId, projectId));

  const done = tasks.filter((t) => t.status === "done").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const blocked = tasks.filter((t) => t.status === "blocked").length;
  const total = tasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Link href={`/projects/${projectId}/documents`}>
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 mb-1">
            <ArrowLeft className="w-4 h-4" /> Documents
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Agent Progress</h1>
        <p className="text-muted-foreground text-sm">{project.name} — Connect an AI coding agent</p>
      </div>

      {/* Progress overview */}
      {total > 0 && (
        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">Build Progress</p>
              <span className="text-2xl font-bold text-primary">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2 mb-4" />
            <div className="grid grid-cols-4 gap-4 text-center">
              {[
                { label: "Total Tasks", value: total, color: "text-foreground" },
                { label: "In Progress", value: inProgress, color: "text-amber-600" },
                { label: "Completed", value: done, color: "text-emerald-600" },
                { label: "Blocked", value: blocked, color: "text-red-600" },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <p className={cn("text-2xl font-bold", color)}>{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent connections (Phase 2) */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-foreground mb-3">Available Agents</h2>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {AGENT_TYPES.map(({ id, name, icon: Icon, desc, status }) => (
            <Card key={id} className="relative overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-foreground text-sm">{name}</p>
                      <Badge variant="outline" className="text-xs text-muted-foreground">Phase 2</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="w-full mt-4" disabled>
                  Connect Agent
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Manual export */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">Manual Agent Integration</p>
              <p className="text-sm text-muted-foreground mb-3">
                While MCP/IDE integration is in Phase 2, you can export your build tasks and document summaries as a prompt package to paste directly into Cursor, Windsurf, or Claude Code.
              </p>
              <Link href={`/projects/${projectId}/tasks`}>
                <Button size="sm" className="gap-2">
                  View Build Tasks →
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
