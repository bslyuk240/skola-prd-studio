import { z } from "zod";
import { PROJECT_DOCUMENT_TYPE_VALUES } from "@/lib/project-document-types";
import { featureDocTypeValues } from "@/lib/validators/feature-doc-types";

export const mcpStudioToolNameSchema = z.enum([
  "list_projects",
  "create_project",
  "get_project_status",
  "get_document",
  "generate_document",
  "generate_all_documents",
  "export_project",
  "request_feature",
  "get_feature_status",
  "get_feature_document",
  "generate_feature_document",
  "generate_all_feature_documents",
  "run_security_scan",
  "get_security_scan",
]);

export const mcpStudioRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  method: z.enum(["initialize", "notifications/initialized", "tools/list", "list_tools", "tools/call"]),
  params: z.any().optional(),
  id: z.union([z.string(), z.number()]).optional(),
});

export const mcpStudioToolCallParamsSchema = z.object({
  name: mcpStudioToolNameSchema,
  arguments: z.record(z.string(), z.unknown()).optional(),
});

// Mirrors the New Blueprint Wizard's input shape (see POST /api/projects) —
// only appName and shortDescription are required so an IDE agent can create
// a project from a one-line description alone.
export const createProjectParams = z.object({
  appName: z.string().min(1),
  shortDescription: z.string().min(1),
  longDescription: z.string().optional(),
  appCategory: z.string().optional(),
  targetUsers: z.string().optional(),
  problemSolved: z.string().optional(),
  mainGoal: z.string().optional(),
  platformType: z.string().optional(),
  frontendFramework: z.string().optional(),
  backendFramework: z.string().optional(),
  database: z.string().optional(),
  authProvider: z.string().optional(),
  hostingProvider: z.string().optional(),
  fileStorage: z.string().optional(),
  paymentProvider: z.string().optional(),
  userRoles: z.string().optional(),
  mainFeatures: z.string().optional(),
  adminFeatures: z.string().optional(),
  monetisationModel: z.string().optional(),
  notificationNeeds: z.string().optional(),
  integrationNeeds: z.string().optional(),
  multiTenancy: z.boolean().optional(),
  fileUpload: z.boolean().optional(),
  securityLevel: z.enum(["basic", "standard", "high", "enterprise"]).optional(),
  securityToggles: z.record(z.string(), z.boolean()).optional(),
});

export const projectIdParams = z.object({
  projectId: z.string().uuid(),
});

export const getDocumentParams = z.object({
  projectId: z.string().uuid(),
  documentType: z.enum(PROJECT_DOCUMENT_TYPE_VALUES),
});

export const generateDocumentParams = getDocumentParams;

export const exportProjectParams = z.object({
  projectId: z.string().uuid(),
  force: z.boolean().optional(),
});

export const requestFeatureParams = z.object({
  projectId: z.string().uuid().optional(),
  repoConnectionId: z.string().optional(),
  featureName: z.string().min(1),
  featureDescription: z.string().min(1),
  affectedRoles: z.string().optional(),
  affectsPermissions: z.boolean().optional(),
  needsNewTables: z.boolean().optional(),
  needsNotifications: z.boolean().optional(),
  affectsDashboard: z.boolean().optional(),
  mobileRequired: z.boolean().optional(),
  affectsBilling: z.boolean().optional(),
  scopeLevel: z.enum(["mvp", "full"]).optional(),
  additionalContext: z.string().optional(),
});

export const featureRequestIdParams = z.object({
  featureRequestId: z.string().uuid(),
});

export const getFeatureDocumentParams = z.object({
  featureRequestId: z.string().uuid(),
  documentType: z.enum(featureDocTypeValues),
});

export const generateFeatureDocumentParams = getFeatureDocumentParams;

export const runSecurityScanParams = z.object({
  provider: z.enum(["github", "manual"]).default("github"),
  repoUrl: z.string().optional(),
  branch: z.string().optional(),
  accessToken: z.string().optional(),
  manualContext: z.string().optional(),
  projectId: z.string().uuid().optional(),
});

export const getSecurityScanParams = z.object({
  scanId: z.string().uuid(),
});
