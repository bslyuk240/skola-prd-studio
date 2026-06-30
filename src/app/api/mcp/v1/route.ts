import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, documents, buildTasks, agentConnections, agentSessions, agentLogs, agentQuestions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { hashAgentToken } from "@/lib/agent-tokens";
import { buildTaskPacket } from "@/lib/task-packet";
import {
  mcpRequestSchema,
  toolCallParamsSchema,
  reportProgressParams,
  reportCompletedParams,
  createQuestionParams,
} from "@/lib/validators/mcp";

const TOOLS = [
  {
    name: "get_project_blueprint",
    description: "Fetch the project's stack, architecture, and security context.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_next_approved_task",
    description: "Claim and fetch the next approved task packet for this project.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "report_task_progress",
    description: "Submit a progress update for a task (in_progress, blocked, or needs_review).",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string" },
        status: { type: "string", enum: ["in_progress", "blocked", "needs_review"] },
        message: { type: "string" },
      },
      required: ["taskId", "status", "message"],
    },
  },
  {
    name: "report_task_completed",
    description: "Report a task as done locally — moves it to human review with a summary, files changed, and test results.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string" },
        summary: { type: "string" },
        filesChanged: { type: "array" },
        testsRun: { type: "array" },
      },
      required: ["taskId", "summary"],
    },
  },
  {
    name: "create_question_for_user",
    description: "Ask the project owner a clarifying question instead of guessing.",
    inputSchema: {
      type: "object",
      properties: { taskId: { type: "string" }, question: { type: "string" } },
      required: ["taskId", "question"],
    },
  },
];

const PRIORITY_WEIGHT: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function rpcError(id: string | number, code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } }, { status: 200 });
}

function rpcResult(id: string | number, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  const tokenHash = hashAgentToken(token);
  const [connection] = await db
    .select()
    .from(agentConnections)
    .where(and(eq(agentConnections.tokenHash, tokenHash), eq(agentConnections.status, "active")))
    .limit(1);
  return connection ?? null;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = mcpRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ jsonrpc: "2.0", id: body?.id ?? null, error: { code: -32600, message: "Invalid request" } });
  }
  const { id, method, params } = parsed.data;

  const connection = await authenticate(req);
  if (!connection) return rpcError(id, -32001, "Unauthorized — invalid or revoked token");

  if (method === "tools/list" || method === "list_tools") {
    return rpcResult(id, { tools: TOOLS });
  }

  // method === "tools/call"
  const callParsed = toolCallParamsSchema.safeParse(params);
  if (!callParsed.success) return rpcError(id, -32602, "Invalid params");
  const { name, arguments: args = {} } = callParsed.data;

  try {
    switch (name) {
      case "get_project_blueprint":
        return rpcResult(id, await getProjectBlueprint(connection.projectId));

      case "get_next_approved_task":
        return rpcResult(id, await getNextApprovedTask(connection.projectId, connection.id));

      case "report_task_progress": {
        const p = reportProgressParams.safeParse(args);
        if (!p.success) return rpcError(id, -32602, "Invalid params for report_task_progress");
        return rpcResult(id, await reportTaskProgress(connection.projectId, connection.id, p.data));
      }

      case "report_task_completed": {
        const p = reportCompletedParams.safeParse(args);
        if (!p.success) return rpcError(id, -32602, "Invalid params for report_task_completed");
        return rpcResult(id, await reportTaskCompleted(connection.projectId, connection.id, p.data));
      }

      case "create_question_for_user": {
        const p = createQuestionParams.safeParse(args);
        if (!p.success) return rpcError(id, -32602, "Invalid params for create_question_for_user");
        return rpcResult(id, await createQuestionForUser(connection.projectId, p.data));
      }

      default:
        return rpcError(id, -32601, "Method not found");
    }
  } catch (err) {
    console.error("[mcp/v1]", err);
    return rpcError(id, -32603, "Internal error");
  }
}

// ─── Tool implementations ──────────────────────────────────────────────────────

async function getProjectBlueprint(projectId: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) throw new Error("Project not found");

  const docs = await db.select().from(documents).where(eq(documents.projectId, projectId));
  const pick = (type: string) => docs.find((d) => d.type === type)?.content?.slice(0, 1500) ?? null;

  return {
    project: project.name,
    stack: project.stackPreferences ?? {},
    securityLevel: project.securityLevel,
    documents: {
      prd: pick("prd"),
      trd: pick("trd"),
      backend_schema: pick("backend_schema"),
      security_blueprint: pick("security_blueprint"),
    },
  };
}

async function getNextApprovedTask(projectId: string, connectionId: string) {
  const candidates = await db
    .select()
    .from(buildTasks)
    .where(and(eq(buildTasks.projectId, projectId), eq(buildTasks.status, "ready"), eq(buildTasks.isApprovedForAgent, true)));

  if (candidates.length === 0) return { task: null, message: "No approved tasks ready for handoff." };

  candidates.sort((a, b) => {
    const pa = PRIORITY_WEIGHT[a.priority ?? "medium"] ?? 2;
    const pb = PRIORITY_WEIGHT[b.priority ?? "medium"] ?? 2;
    if (pa !== pb) return pa - pb;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const task = candidates[0];

  // Claim: move to in_progress, lock to this connection, start a session.
  await db
    .update(buildTasks)
    .set({ status: "in_progress", assignedConnectionId: connectionId, updatedAt: new Date() })
    .where(eq(buildTasks.id, task.id));

  const [connection] = await db.select().from(agentConnections).where(eq(agentConnections.id, connectionId)).limit(1);

  const [session] = await db
    .insert(agentSessions)
    .values({
      projectId,
      agentType: connection?.agentType ?? "other",
      agentConnectionId: connectionId,
      status: "active",
      connectionStatus: "active",
      currentTaskId: task.id,
    })
    .returning();

  await db.insert(agentLogs).values({
    projectId,
    taskId: task.id,
    agentSessionId: session.id,
    eventType: "task_claimed",
    message: `Task claimed by ${connection?.connectionName ?? "agent"}.`,
    status: "in_progress",
  });

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  const docs = await db.select().from(documents).where(eq(documents.projectId, projectId));

  return { sessionId: session.id, ...buildTaskPacket(project!, task, docs) };
}

async function findOwnedTask(projectId: string, connectionId: string, taskId: string) {
  const [task] = await db
    .select()
    .from(buildTasks)
    .where(and(eq(buildTasks.id, taskId), eq(buildTasks.projectId, projectId)))
    .limit(1);
  if (!task) throw new Error("Task not found");
  if (task.assignedConnectionId && task.assignedConnectionId !== connectionId) {
    throw new Error("Task is claimed by a different connection");
  }
  return task;
}

async function findActiveSession(projectId: string, connectionId: string, taskId: string) {
  const [session] = await db
    .select()
    .from(agentSessions)
    .where(
      and(
        eq(agentSessions.projectId, projectId),
        eq(agentSessions.agentConnectionId, connectionId),
        eq(agentSessions.currentTaskId, taskId)
      )
    )
    .limit(1);
  return session ?? null;
}

async function reportTaskProgress(
  projectId: string,
  connectionId: string,
  data: { taskId: string; status: "in_progress" | "blocked" | "needs_review"; message: string }
) {
  await findOwnedTask(projectId, connectionId, data.taskId);
  const session = await findActiveSession(projectId, connectionId, data.taskId);

  const newStatus = data.status === "needs_review" ? "review" : data.status;
  await db.update(buildTasks).set({ status: newStatus, updatedAt: new Date() }).where(eq(buildTasks.id, data.taskId));

  await db.insert(agentLogs).values({
    projectId,
    taskId: data.taskId,
    agentSessionId: session?.id ?? null,
    eventType: data.status === "blocked" ? "blocked" : data.status === "needs_review" ? "needs_review" : "progress_update",
    message: data.message,
    status: newStatus,
  });

  return { acknowledged: true, taskId: data.taskId, newStatus };
}

async function reportTaskCompleted(
  projectId: string,
  connectionId: string,
  data: {
    taskId: string;
    summary: string;
    filesChanged: { filePath: string; changeSummary: string; riskLevel: "low" | "medium" | "high" }[];
    testsRun: { command: string; status: "passed" | "failed"; summary?: string }[];
  }
) {
  await findOwnedTask(projectId, connectionId, data.taskId);
  const session = await findActiveSession(projectId, connectionId, data.taskId);

  // Human review gate — never auto-marks "done".
  await db.update(buildTasks).set({ status: "review", updatedAt: new Date() }).where(eq(buildTasks.id, data.taskId));

  await db.insert(agentLogs).values({
    projectId,
    taskId: data.taskId,
    agentSessionId: session?.id ?? null,
    eventType: "completed",
    message: data.summary,
    status: "review",
    filesChanged: data.filesChanged,
    testResult: data.testsRun,
  });

  if (session) {
    await db.update(agentSessions).set({ status: "completed", endedAt: new Date() }).where(eq(agentSessions.id, session.id));
  }

  return { acknowledged: true, taskId: data.taskId, newStatus: "review" };
}

async function createQuestionForUser(projectId: string, data: { taskId: string; question: string }) {
  const [question] = await db
    .insert(agentQuestions)
    .values({ projectId, taskId: data.taskId, question: data.question })
    .returning();

  await db.insert(agentLogs).values({
    projectId,
    taskId: data.taskId,
    agentSessionId: null,
    eventType: "question_asked",
    message: data.question,
  });

  return { questionId: question.id, status: "pending" };
}
