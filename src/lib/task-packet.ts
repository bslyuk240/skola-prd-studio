import type { Project, BuildTask, Document } from "@/db/schema";

export interface TaskPacket {
  projectId: string;
  projectName: string;
  stack: Record<string, string>;
  taskId: string;
  title: string;
  description: string | null;
  priority: string | null;
  phase: string | null;
  acceptanceCriteria: string[];
  securityRequirements: string[];
  suggestedFilesToInspect: string[];
  doNotChange: string[];
  formattedManualPrompt: string;
}

function excerpt(content: string | null | undefined, maxChars = 1200): string {
  if (!content) return "";
  return content.length > maxChars ? `${content.slice(0, maxChars)}…(truncated)` : content;
}

export function buildTaskPacket(project: Project, task: BuildTask, docs: Document[]): TaskPacket {
  const stack = (project.stackPreferences as Record<string, string>) ?? {};

  const acceptanceCriteria = task.acceptanceCriteria
    ? task.acceptanceCriteria.split(/\n+/).map((l) => l.replace(/^[-*]\s*/, "").trim()).filter(Boolean)
    : [];

  const securityRequirements = task.securityImpact
    ? task.securityImpact.split(/\n+/).map((l) => l.replace(/^[-*]\s*/, "").trim()).filter(Boolean)
    : [];

  const suggestedFilesToInspect = Array.isArray(task.filesAffected) ? (task.filesAffected as string[]) : [];

  const doNotChange = [
    "Do not redesign existing UI components outside this task's scope.",
    "Do not change the database schema unless this task explicitly requires it.",
    "Do not remove or weaken existing auth, validation, or security logic.",
    "Report changed files and test results back to PRD Studio when done.",
  ];

  const securityBlueprint = docs.find((d) => d.type === "security_blueprint");
  const backendSchema = docs.find((d) => d.type === "backend_schema");
  const trd = docs.find((d) => d.type === "trd");

  const lines: string[] = [];
  lines.push(`### PROJECT CONTEXT`);
  lines.push(`Project: ${project.name}`);
  if (Object.keys(stack).length) {
    lines.push(`Stack: ${Object.entries(stack).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(", ")}`);
  }
  lines.push("");
  lines.push(`### TASK`);
  lines.push(`${task.title}`);
  if (task.description) lines.push(task.description);
  lines.push("");
  if (acceptanceCriteria.length) {
    lines.push(`### ACCEPTANCE CRITERIA`);
    acceptanceCriteria.forEach((c) => lines.push(`- ${c}`));
    lines.push("");
  }
  if (securityRequirements.length) {
    lines.push(`### SECURITY REQUIREMENTS`);
    securityRequirements.forEach((c) => lines.push(`- ${c}`));
    lines.push("");
  }
  if (suggestedFilesToInspect.length) {
    lines.push(`### FILES LIKELY AFFECTED`);
    suggestedFilesToInspect.forEach((f) => lines.push(`- ${f}`));
    lines.push("");
  }
  if (trd?.content) {
    lines.push(`### RELEVANT TECHNICAL CONTEXT (TRD excerpt)`);
    lines.push(excerpt(trd.content));
    lines.push("");
  }
  if (backendSchema?.content) {
    lines.push(`### RELEVANT SCHEMA CONTEXT (excerpt)`);
    lines.push(excerpt(backendSchema.content));
    lines.push("");
  }
  if (securityBlueprint?.content) {
    lines.push(`### SECURITY BLUEPRINT (excerpt)`);
    lines.push(excerpt(securityBlueprint.content));
    lines.push("");
  }
  lines.push(`### RULES`);
  doNotChange.forEach((r) => lines.push(`- ${r}`));

  return {
    projectId: project.id,
    projectName: project.name,
    stack,
    taskId: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    phase: task.phase,
    acceptanceCriteria,
    securityRequirements,
    suggestedFilesToInspect,
    doNotChange,
    formattedManualPrompt: lines.join("\n"),
  };
}
