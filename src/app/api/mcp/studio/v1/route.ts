import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  projects,
  documents,
  buildTasks,
  featureRequests,
  featureDocuments,
  securityScans,
  securityFindings,
  personalApiKeys,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { hashPersonalApiKey } from "@/lib/personal-api-keys";
import {
  mcpStudioRequestSchema,
  mcpStudioToolCallParamsSchema,
  createProjectParams,
  projectIdParams,
  getDocumentParams,
  generateDocumentParams,
  exportProjectParams,
  requestFeatureParams,
  featureRequestIdParams,
  getFeatureDocumentParams,
  generateFeatureDocumentParams,
  runSecurityScanParams,
  getSecurityScanParams,
} from "@/lib/validators/mcp-studio";
import { createProjectFromInput } from "@/lib/mcp-studio/create-project";
import {
  dispatchSingleDocumentGeneration,
  approveBlueprintAndQueueAllDocuments,
} from "@/lib/mcp-studio/document-orchestration";
import { requestFeatureFromInput } from "@/lib/mcp-studio/request-feature";
import {
  dispatchSingleFeatureDocumentGeneration,
  queueAllFeatureDocuments,
} from "@/lib/mcp-studio/feature-orchestration";
import { runSecurityScan } from "@/lib/security-scan-runner";
import { buildProjectBlueprintMarkdown } from "@/lib/project-export";
import { ensureProjectBlueprint } from "@/lib/blueprint-engine/project-blueprint-service";
import { buildIntegrityReport } from "@/lib/blueprint-engine/integrity-report";
import { PROJECT_DOCUMENT_DEFINITIONS } from "@/lib/project-document-types";

const TOOLS = [
  {
    name: "list_projects",
    description: "List every project (PRD/build blueprint) in your SkolaTech PRD Studio account.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "create_project",
    description:
      "Create a new project and start a PRD/TRD/build-blueprint from an app idea. Only appName and shortDescription are required — everything else (stack, features, roles) is optional and will be inferred if omitted. Returns a projectId; call generate_all_documents next to generate the actual documents.",
    inputSchema: {
      type: "object",
      properties: {
        appName: { type: "string" },
        shortDescription: { type: "string", description: "One or two sentence summary of the app idea." },
        longDescription: { type: "string" },
        appCategory: { type: "string" },
        targetUsers: { type: "string" },
        problemSolved: { type: "string" },
        mainGoal: { type: "string" },
        platformType: { type: "string", description: "e.g. web, mobile, web+mobile" },
        frontendFramework: { type: "string" },
        backendFramework: { type: "string" },
        database: { type: "string" },
        authProvider: { type: "string" },
        hostingProvider: { type: "string" },
        fileStorage: { type: "string" },
        paymentProvider: { type: "string" },
        userRoles: { type: "string" },
        mainFeatures: { type: "string" },
        adminFeatures: { type: "string" },
        monetisationModel: { type: "string" },
        notificationNeeds: { type: "string" },
        integrationNeeds: { type: "string" },
        multiTenancy: { type: "boolean" },
        fileUpload: { type: "boolean" },
        securityLevel: { type: "string", enum: ["basic", "standard", "high", "enterprise"] },
      },
      required: ["appName", "shortDescription"],
    },
  },
  {
    name: "get_project_status",
    description: "Get a project's readiness score and the generation status of every document.",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string" } },
      required: ["projectId"],
    },
  },
  {
    name: "get_document",
    description: "Fetch the full content of one generated document (PRD, TRD, backend schema, etc.) from a project.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        documentType: {
          type: "string",
          enum: PROJECT_DOCUMENT_DEFINITIONS.map((d) => d.type),
        },
      },
      required: ["projectId", "documentType"],
    },
  },
  {
    name: "generate_document",
    description:
      "Kick off generation of one document type for a project. Returns immediately with status 'generating' — poll get_project_status or get_document to see when it's ready (usually 20-40s).",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        documentType: {
          type: "string",
          enum: PROJECT_DOCUMENT_DEFINITIONS.map((d) => d.type),
        },
      },
      required: ["projectId", "documentType"],
    },
  },
  {
    name: "generate_all_documents",
    description:
      "Approve the project's architecture model and queue generation of all pending documents (PRD, TRD, App Flow, UI/UX Brief, Backend Schema, Implementation Plan, Security Blueprint, API & Integration Spec, Testing & QA Plan, Deployment & Ops Plan). Returns immediately — poll get_project_status to track progress.",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string" } },
      required: ["projectId"],
    },
  },
  {
    name: "export_project",
    description:
      "Export the full project blueprint (all documents + build task roadmap) as one Markdown document, ready to hand to a coding agent. Fails if unresolved integrity errors exist unless force is set.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        force: { type: "boolean", description: "Export even if blocking integrity errors remain." },
      },
      required: ["projectId"],
    },
  },
  {
    name: "request_feature",
    description:
      "Start a feature-addition blueprint: Feature PRD, Impact Analysis, Schema/API changes, UI changes, Security checklist, Implementation tasks, Test plan, Deployment plan. Optionally link it to an existing projectId for context-aware generation. Returns a featureRequestId; call generate_all_feature_documents next.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Optional — link to an existing project for context." },
        featureName: { type: "string" },
        featureDescription: { type: "string" },
        affectedRoles: { type: "string" },
        affectsPermissions: { type: "boolean" },
        needsNewTables: { type: "boolean" },
        needsNotifications: { type: "boolean" },
        affectsDashboard: { type: "boolean" },
        mobileRequired: { type: "boolean" },
        affectsBilling: { type: "boolean" },
        scopeLevel: { type: "string", enum: ["mvp", "full"] },
        additionalContext: { type: "string" },
      },
      required: ["featureName", "featureDescription"],
    },
  },
  {
    name: "get_feature_status",
    description: "Get a feature request's document generation statuses.",
    inputSchema: {
      type: "object",
      properties: { featureRequestId: { type: "string" } },
      required: ["featureRequestId"],
    },
  },
  {
    name: "get_feature_document",
    description: "Fetch the full content of one generated feature document.",
    inputSchema: {
      type: "object",
      properties: {
        featureRequestId: { type: "string" },
        documentType: {
          type: "string",
          enum: ["feature_prd", "impact_analysis", "schema_changes", "api_changes", "ui_changes", "security_checklist", "implementation_tasks", "test_plan", "deployment_plan"],
        },
      },
      required: ["featureRequestId", "documentType"],
    },
  },
  {
    name: "generate_feature_document",
    description: "Kick off generation of one feature document type. Returns immediately — poll get_feature_status.",
    inputSchema: {
      type: "object",
      properties: {
        featureRequestId: { type: "string" },
        documentType: {
          type: "string",
          enum: ["feature_prd", "impact_analysis", "schema_changes", "api_changes", "ui_changes", "security_checklist", "implementation_tasks", "test_plan", "deployment_plan"],
        },
      },
      required: ["featureRequestId", "documentType"],
    },
  },
  {
    name: "generate_all_feature_documents",
    description: "Queue generation of every pending document for a feature request. Returns immediately — poll get_feature_status.",
    inputSchema: {
      type: "object",
      properties: { featureRequestId: { type: "string" } },
      required: ["featureRequestId"],
    },
  },
  {
    name: "run_security_scan",
    description:
      "Run a security scan and generate a Security Fix PRD. Provide either a public/accessible repoUrl (provider 'github') or manualContext describing the stack (provider 'manual'). Optionally link projectId for context. This call blocks until the scan and PRD are ready (usually well under a minute).",
    inputSchema: {
      type: "object",
      properties: {
        provider: { type: "string", enum: ["github", "manual"] },
        repoUrl: { type: "string" },
        branch: { type: "string" },
        accessToken: { type: "string", description: "GitHub access token for private repos (optional)." },
        manualContext: { type: "string", description: "Free-text description of the stack/architecture when not scanning a repo." },
        projectId: { type: "string" },
      },
      required: [],
    },
  },
  {
    name: "get_security_scan",
    description: "Fetch a completed security scan's findings and the generated Security Fix PRD content.",
    inputSchema: {
      type: "object",
      properties: { scanId: { type: "string" } },
      required: ["scanId"],
    },
  },
];

function rpcError(id: string | number | null | undefined, code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, { status: 200 });
}

function rpcResult(id: string | number | null | undefined, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result });
}

// See src/app/api/mcp/v1/route.ts for why tools/call results must use the
// MCP CallToolResult `content` array shape rather than a raw object.
function toolResult(id: string | number | null | undefined, data: unknown) {
  return NextResponse.json({
    jsonrpc: "2.0",
    id: id ?? null,
    result: { content: [{ type: "text", text: JSON.stringify(data) }] },
  });
}

const MCP_PROTOCOL_VERSION = "2024-11-05";

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  const tokenHash = hashPersonalApiKey(token);
  const [key] = await db
    .select()
    .from(personalApiKeys)
    .where(and(eq(personalApiKeys.tokenHash, tokenHash), eq(personalApiKeys.status, "active")))
    .limit(1);
  if (!key) return null;

  // Best-effort, non-blocking last-used timestamp.
  void db.update(personalApiKeys).set({ lastUsedAt: new Date() }).where(eq(personalApiKeys.id, key.id)).then(
    () => {},
    () => {}
  );

  return key;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = mcpStudioRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ jsonrpc: "2.0", id: body?.id ?? null, error: { code: -32600, message: "Invalid request" } });
  }
  const { id, method, params } = parsed.data;

  if (method === "notifications/initialized") {
    return new NextResponse(null, { status: 202 });
  }

  const apiKey = await authenticate(req);
  if (!apiKey) return rpcError(id, -32001, "Unauthorized — invalid or revoked API key");
  const userId = apiKey.userId;

  if (method === "initialize") {
    return rpcResult(id, {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: "prd-studio-tools", version: "1.0.0" },
    });
  }

  if (method === "tools/list" || method === "list_tools") {
    return rpcResult(id, { tools: TOOLS });
  }

  const callParsed = mcpStudioToolCallParamsSchema.safeParse(params);
  if (!callParsed.success) return rpcError(id, -32602, "Invalid params");
  const { name, arguments: args = {} } = callParsed.data;

  try {
    switch (name) {
      case "list_projects":
        return toolResult(id, await listProjects(userId));

      case "create_project": {
        const p = createProjectParams.safeParse(args);
        if (!p.success) return rpcError(id, -32602, "Invalid params for create_project");
        const project = await createProjectFromInput(userId, p.data);
        return toolResult(id, { projectId: project.id, name: project.name });
      }

      case "get_project_status": {
        const p = projectIdParams.safeParse(args);
        if (!p.success) return rpcError(id, -32602, "Invalid params for get_project_status");
        const result = await getProjectStatus(userId, p.data.projectId);
        if (!result) return rpcError(id, -32602, "Project not found");
        return toolResult(id, result);
      }

      case "get_document": {
        const p = getDocumentParams.safeParse(args);
        if (!p.success) return rpcError(id, -32602, "Invalid params for get_document");
        const result = await getDocument(userId, p.data.projectId, p.data.documentType);
        if (!result) return rpcError(id, -32602, "Project or document not found");
        return toolResult(id, result);
      }

      case "generate_document": {
        const p = generateDocumentParams.safeParse(args);
        if (!p.success) return rpcError(id, -32602, "Invalid params for generate_document");
        const project = await getOwnedProject(userId, p.data.projectId);
        if (!project) return rpcError(id, -32602, "Project not found");
        const siteUrl = siteUrlFromRequest(req);
        const outcome = await dispatchSingleDocumentGeneration(project, p.data.documentType, userId, siteUrl, {
          autoApproveBlueprint: true,
        });
        return toolResult(id, outcome);
      }

      case "generate_all_documents": {
        const p = projectIdParams.safeParse(args);
        if (!p.success) return rpcError(id, -32602, "Invalid params for generate_all_documents");
        const project = await getOwnedProject(userId, p.data.projectId);
        if (!project) return rpcError(id, -32602, "Project not found");
        const siteUrl = siteUrlFromRequest(req);
        const outcome = await approveBlueprintAndQueueAllDocuments(project, userId, siteUrl);
        return toolResult(id, outcome);
      }

      case "export_project": {
        const p = exportProjectParams.safeParse(args);
        if (!p.success) return rpcError(id, -32602, "Invalid params for export_project");
        const result = await exportProject(userId, p.data.projectId, p.data.force ?? false);
        if (!result) return rpcError(id, -32602, "Project not found");
        return toolResult(id, result);
      }

      case "request_feature": {
        const p = requestFeatureParams.safeParse(args);
        if (!p.success) return rpcError(id, -32602, "Invalid params for request_feature");
        const outcome = await requestFeatureFromInput(userId, p.data);
        if (!outcome.ok) return rpcError(id, -32602, outcome.error);
        return toolResult(id, { requestId: outcome.requestId });
      }

      case "get_feature_status": {
        const p = featureRequestIdParams.safeParse(args);
        if (!p.success) return rpcError(id, -32602, "Invalid params for get_feature_status");
        const result = await getFeatureStatus(userId, p.data.featureRequestId);
        if (!result) return rpcError(id, -32602, "Feature request not found");
        return toolResult(id, result);
      }

      case "get_feature_document": {
        const p = getFeatureDocumentParams.safeParse(args);
        if (!p.success) return rpcError(id, -32602, "Invalid params for get_feature_document");
        const result = await getFeatureDocument(userId, p.data.featureRequestId, p.data.documentType);
        if (!result) return rpcError(id, -32602, "Feature request or document not found");
        return toolResult(id, result);
      }

      case "generate_feature_document": {
        const p = generateFeatureDocumentParams.safeParse(args);
        if (!p.success) return rpcError(id, -32602, "Invalid params for generate_feature_document");
        const owned = await getOwnedFeatureRequest(userId, p.data.featureRequestId);
        if (!owned) return rpcError(id, -32602, "Feature request not found");
        const siteUrl = siteUrlFromRequest(req);
        const outcome = await dispatchSingleFeatureDocumentGeneration(p.data.featureRequestId, p.data.documentType, userId, siteUrl);
        return toolResult(id, outcome);
      }

      case "generate_all_feature_documents": {
        const p = featureRequestIdParams.safeParse(args);
        if (!p.success) return rpcError(id, -32602, "Invalid params for generate_all_feature_documents");
        const owned = await getOwnedFeatureRequest(userId, p.data.featureRequestId);
        if (!owned) return rpcError(id, -32602, "Feature request not found");
        const siteUrl = siteUrlFromRequest(req);
        const outcome = await queueAllFeatureDocuments(p.data.featureRequestId, userId, siteUrl);
        return toolResult(id, outcome);
      }

      case "run_security_scan": {
        const p = runSecurityScanParams.safeParse(args);
        if (!p.success) return rpcError(id, -32602, "Invalid params for run_security_scan");
        const outcome = await runSecurityScan({ userId, ...p.data });
        if (!outcome.ok) return rpcError(id, -32602, outcome.error);
        return toolResult(id, outcome.result);
      }

      case "get_security_scan": {
        const p = getSecurityScanParams.safeParse(args);
        if (!p.success) return rpcError(id, -32602, "Invalid params for get_security_scan");
        const result = await getSecurityScan(userId, p.data.scanId);
        if (!result) return rpcError(id, -32602, "Security scan not found");
        return toolResult(id, result);
      }

      default:
        return rpcError(id, -32601, "Method not found");
    }
  } catch (err) {
    console.error("[mcp/studio/v1]", err);
    return rpcError(id, -32603, "Internal error");
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function siteUrlFromRequest(req: NextRequest) {
  return process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? req.nextUrl.origin;
}

async function getOwnedProject(userId: string, projectId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  return project ?? null;
}

async function getOwnedFeatureRequest(userId: string, featureRequestId: string) {
  const [request] = await db
    .select()
    .from(featureRequests)
    .where(and(eq(featureRequests.id, featureRequestId), eq(featureRequests.userId, userId)))
    .limit(1);
  return request ?? null;
}

async function listProjects(userId: string) {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      status: projects.status,
      readinessScore: projects.readinessScore,
      securityScore: projects.securityScore,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.updatedAt));
  return { projects: rows };
}

async function getProjectStatus(userId: string, projectId: string) {
  const project = await getOwnedProject(userId, projectId);
  if (!project) return null;

  const docs = await db.select().from(documents).where(eq(documents.projectId, projectId));
  const tasks = await db.select().from(buildTasks).where(eq(buildTasks.projectId, projectId));

  return {
    project: {
      id: project.id,
      name: project.name,
      status: project.status,
      readinessScore: project.readinessScore,
      securityScore: project.securityScore,
    },
    documents: docs.map((d) => ({ type: d.type, status: d.status, wordCount: d.wordCount })),
    taskCount: tasks.length,
  };
}

async function getDocument(userId: string, projectId: string, documentType: string) {
  const project = await getOwnedProject(userId, projectId);
  if (!project) return null;

  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.projectId, projectId), eq(documents.type, documentType as (typeof documents.$inferSelect)["type"])))
    .limit(1);
  if (!doc) return null;

  return { type: doc.type, title: doc.title, status: doc.status, wordCount: doc.wordCount, content: doc.content };
}

async function exportProject(userId: string, projectId: string, force: boolean) {
  const project = await getOwnedProject(userId, projectId);
  if (!project) return null;

  const docs = await db.select().from(documents).where(eq(documents.projectId, projectId));
  const tasks = await db.select().from(buildTasks).where(eq(buildTasks.projectId, projectId));

  const blueprint = await ensureProjectBlueprint(project);
  const snapshots = docs.filter((doc) => doc.content).map((doc) => ({ type: doc.type, content: doc.content! }));
  const integrityReport = buildIntegrityReport(blueprint, snapshots, { allowExportWithErrors: force });

  if (!integrityReport.canExport) {
    return {
      exported: false,
      error: "Export blocked until all ERROR-level integrity issues are resolved. Retry with force: true to export anyway.",
      errorCount: integrityReport.errorCount,
      issues: integrityReport.issues.filter((issue) => issue.severity === "error"),
    };
  }

  const markdown = buildProjectBlueprintMarkdown(project, docs, tasks, integrityReport, { forceExport: force });
  return { exported: true, markdown };
}

async function getFeatureStatus(userId: string, featureRequestId: string) {
  const request = await getOwnedFeatureRequest(userId, featureRequestId);
  if (!request) return null;

  const docs = await db.select().from(featureDocuments).where(eq(featureDocuments.featureRequestId, featureRequestId));

  return {
    featureRequest: {
      id: request.id,
      featureName: request.featureName,
      status: request.status,
      projectId: request.projectId,
    },
    documents: docs.map((d) => ({ type: d.type, status: d.status, wordCount: d.wordCount })),
  };
}

async function getFeatureDocument(userId: string, featureRequestId: string, documentType: string) {
  const request = await getOwnedFeatureRequest(userId, featureRequestId);
  if (!request) return null;

  const [doc] = await db
    .select()
    .from(featureDocuments)
    .where(
      and(
        eq(featureDocuments.featureRequestId, featureRequestId),
        eq(featureDocuments.type, documentType as (typeof featureDocuments.$inferSelect)["type"])
      )
    )
    .limit(1);
  if (!doc) return null;

  return { type: doc.type, title: doc.title, status: doc.status, wordCount: doc.wordCount, content: doc.content };
}

async function getSecurityScan(userId: string, scanId: string) {
  const [scan] = await db
    .select()
    .from(securityScans)
    .where(and(eq(securityScans.id, scanId), eq(securityScans.userId, userId)))
    .limit(1);
  if (!scan) return null;

  const findings = await db.select().from(securityFindings).where(eq(securityFindings.scanId, scanId));

  return {
    scanId: scan.id,
    status: scan.status,
    safeToShipScore: scan.safeToShipScore,
    confirmedCount: scan.confirmedCount,
    likelyGapCount: scan.likelyGapCount,
    needsReviewCount: scan.needsReviewCount,
    recommendedCount: scan.recommendedCount,
    prdContent: scan.prdContent,
    agentPrompt: scan.agentPrompt,
    findings: findings.map((f) => ({
      title: f.title,
      description: f.description,
      confidence: f.confidence,
      severity: f.severity,
      affectedFiles: f.affectedFiles,
      recommendation: f.recommendation,
    })),
  };
}
