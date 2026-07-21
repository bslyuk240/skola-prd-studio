import { z } from "zod";

export const mcpToolNameSchema = z.enum([
  "get_project_blueprint",
  "get_next_approved_task",
  "get_active_tasks",
  "report_task_progress",
  "report_task_completed",
  "create_question_for_user",
  "query_engineering_knowledge",
]);

export const mcpRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  method: z.enum(["initialize", "notifications/initialized", "tools/list", "list_tools", "tools/call"]),
  params: z.any().optional(),
  // Notifications (e.g. notifications/initialized) carry no id per JSON-RPC spec.
  id: z.union([z.string(), z.number()]).optional(),
});

export const toolCallParamsSchema = z.object({
  name: mcpToolNameSchema,
  arguments: z.record(z.string(), z.unknown()).optional(),
});

export const reportProgressParams = z.object({
  taskId: z.string().min(1),
  status: z.enum(["in_progress", "blocked", "needs_review"]),
  message: z.string().min(1),
});

export const reportCompletedParams = z.object({
  taskId: z.string().min(1),
  summary: z.string().min(1),
  filesChanged: z
    .array(
      z.object({
        filePath: z.string(),
        changeSummary: z.string(),
        riskLevel: z.enum(["low", "medium", "high"]).default("low"),
      })
    )
    .default([]),
  testsRun: z
    .array(
      z.object({
        command: z.string(),
        status: z.enum(["passed", "failed"]),
        summary: z.string().optional(),
      })
    )
    .default([]),
});

export const createQuestionParams = z.object({
  taskId: z.string().min(1),
  question: z.string().min(1),
});

export const queryEngineeringKnowledgeParams = z.object({
  searchQuery: z.string().min(1).max(500),
  category: z.string().optional(),
  limit: z.number().int().min(1).max(10).optional(),
});
