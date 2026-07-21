import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  uuid,
  pgEnum,
  vector,
  numeric,
  unique,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const projectStatusEnum = pgEnum("project_status", [
  "draft",
  "generating",
  "review",
  "approved",
  "building",
]);

export const documentTypeEnum = pgEnum("document_type", [
  "prd",
  "trd",
  "app_flow",
  "ux_brief",
  "backend_schema",
  "implementation_plan",
  "security_blueprint",
]);

export const documentStatusEnum = pgEnum("document_status", [
  "pending",
  "generating",
  "ready",
  "approved",
  "needs_revision",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "backlog",
  "ready",
  "in_progress",
  "review",
  "done",
  "blocked",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const securitySeverityEnum = pgEnum("security_severity", [
  "info",
  "low",
  "medium",
  "high",
  "critical",
]);

export const securityStatusEnum = pgEnum("security_status", [
  "pending",
  "implemented",
  "needs_review",
  "not_applicable",
]);

export const agentTypeEnum = pgEnum("agent_type", [
  "cursor",
  "windsurf",
  "claude_code",
  "copilot",
  "replit",
  "other",
]);

export const agentConnectionStatusEnum = pgEnum("agent_connection_status", [
  "active",
  "revoked",
]);

export const agentSessionStatusEnum = pgEnum("agent_session_status", [
  "active",
  "completed",
  "terminated",
]);

export const agentEventTypeEnum = pgEnum("agent_event_type", [
  "task_claimed",
  "task_started",
  "progress_update",
  "files_changed",
  "tests_passed",
  "tests_failed",
  "blocked",
  "completed",
  "needs_review",
  "question_asked",
]);

// ─── Tables ───────────────────────────────────────────────────────────────────

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(), // Clerk user ID
  name: text("name").notNull(),
  description: text("description"),
  appType: text("app_type"),
  platform: text("platform"),
  stackPreferences: jsonb("stack_preferences"),
  securityLevel: text("security_level").default("standard"),
  status: projectStatusEnum("status").default("draft"),
  readinessScore: integer("readiness_score").default(0),
  securityScore: integer("security_score").default(0),
  agentReadinessScore: integer("agent_readiness_score").default(0),
  wizardData: jsonb("wizard_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectInputs = pgTable("project_inputs", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  answer: text("answer"),
  category: text("category"),
  isRequired: boolean("is_required").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  type: documentTypeEnum("type").notNull(),
  title: text("title").notNull(),
  status: documentStatusEnum("status").default("pending"),
  content: text("content"),
  wordCount: integer("word_count").default(0),
  aiCreditsUsed: integer("ai_credits_used").default(0).notNull(),
  version: integer("version").default(1),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const securityChecks = pgTable("security_checks", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  severity: securitySeverityEnum("severity").default("medium"),
  status: securityStatusEnum("status").default("pending"),
  recommendation: text("recommendation"),
  relatedTaskId: uuid("related_task_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const buildTasks = pgTable("build_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: taskStatusEnum("status").default("backlog"),
  priority: taskPriorityEnum("priority").default("medium"),
  phase: text("phase"),
  relatedDocumentId: uuid("related_document_id"),
  acceptanceCriteria: text("acceptance_criteria"),
  securityImpact: text("security_impact"),
  estimatedEffort: text("estimated_effort"),
  dependencies: jsonb("dependencies"),
  filesAffected: jsonb("files_affected"),
  agentStatus: text("agent_status"),
  notes: text("notes"),
  // IDE Agent Connector
  isApprovedForAgent: boolean("is_approved_for_agent").default(false).notNull(),
  assignedConnectionId: uuid("assigned_connection_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── IDE Agent Connector (MCP) ─────────────────────────────────────────────────

export const agentConnections = pgTable("agent_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  agentType: agentTypeEnum("agent_type").default("other").notNull(),
  connectionName: text("connection_name").notNull(),
  status: agentConnectionStatusEnum("status").default("active").notNull(),
  tokenHash: text("token_hash").unique().notNull(), // SHA-256 hash of the issued bearer token
  scopes: jsonb("scopes").default(["read:context", "write:progress"]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
});

export const agentSessions = pgTable("agent_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  agentType: agentTypeEnum("agent_type").notNull(),
  agentConnectionId: uuid("agent_connection_id")
    .references(() => agentConnections.id, { onDelete: "cascade" }),
  status: agentSessionStatusEnum("status").default("active").notNull(),
  connectionStatus: text("connection_status").default("disconnected"),
  currentTaskId: uuid("current_task_id"),
  startedAt: timestamp("started_at").defaultNow(),
  endedAt: timestamp("ended_at"),
});

export const agentLogs = pgTable("agent_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" }),
  agentSessionId: uuid("agent_session_id")
    .references(() => agentSessions.id, { onDelete: "cascade" }), // null for human-only events (e.g. review decisions)
  taskId: uuid("task_id"),
  eventType: agentEventTypeEnum("event_type").notNull(),
  message: text("message"),
  status: text("status"),
  filesChanged: jsonb("files_changed"),
  testResult: jsonb("test_result"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentQuestions = pgTable("agent_questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").notNull(),
  agentSessionId: uuid("agent_session_id")
    .references(() => agentSessions.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  status: text("status").default("pending").notNull(), // pending | answered
  answer: text("answer"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  answeredAt: timestamp("answered_at"),
});

export type AgentConnection = typeof agentConnections.$inferSelect;
export type AgentSession = typeof agentSessions.$inferSelect;
export type AgentLog = typeof agentLogs.$inferSelect;
export type AgentQuestion = typeof agentQuestions.$inferSelect;

export const exports = pgTable("exports", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  exportType: text("export_type").notNull(),
  fileUrl: text("file_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id").primaryKey(), // Clerk user ID
  aiModel: text("ai_model").default("google/gemini-2.0-flash-001"),
  defaultSecurityLevel: text("default_security_level").default("standard"),
  defaultSecurityToggles: jsonb("default_security_toggles"),
  wordCountVisible: boolean("word_count_visible").default(true),
  autoRefresh: boolean("auto_refresh").default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UserPreferences = typeof userPreferences.$inferSelect;

// ─── Feature Impact Planner ───────────────────────────────────────────────────

export const repoConnectionStatusEnum = pgEnum("repo_connection_status", [
  "pending",
  "scanning",
  "ready",
  "error",
]);

export const featureRequestStatusEnum = pgEnum("feature_request_status", [
  "draft",
  "generating",
  "ready",
  "approved",
]);

export const featureDocTypeEnum = pgEnum("feature_doc_type", [
  "feature_prd",
  "impact_analysis",
  "schema_changes",
  "api_changes",
  "ui_changes",
  "security_checklist",
  "implementation_tasks",
  "test_plan",
  "deployment_plan",
]);

export const repoConnections = pgTable("repo_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  repoUrl: text("repo_url").notNull(),
  repoOwner: text("repo_owner"),
  repoName: text("repo_name"),
  branch: text("branch").default("main"),
  provider: text("provider").default("github"), // github | gitlab | manual
  isPrivate: boolean("is_private").default(false),
  // PAT stored as-is for MVP — encrypt in production
  accessToken: text("access_token"),
  status: repoConnectionStatusEnum("status").default("pending"),
  // Detected project info
  detectedStack: jsonb("detected_stack"),       // { framework, language, db, auth, ui, ... }
  fileTree: jsonb("file_tree"),                 // Array of { path, type }
  keyFilesContent: jsonb("key_files_content"),  // { 'package.json': '...', 'README.md': '...' }
  projectSummary: text("project_summary"),      // AI-written summary of the project
  lastScannedAt: timestamp("last_scanned_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const featureRequests = pgTable("feature_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  repoConnectionId: uuid("repo_connection_id")
    .references(() => repoConnections.id, { onDelete: "cascade" }),
  featureName: text("feature_name").notNull(),
  featureDescription: text("feature_description").notNull(),
  // Clarification answers
  affectedRoles: text("affected_roles"),
  affectsPermissions: boolean("affects_permissions").default(false),
  needsNewTables: boolean("needs_new_tables").default(false),
  needsNotifications: boolean("needs_notifications").default(false),
  affectsDashboard: boolean("affects_dashboard").default(false),
  mobileRequired: boolean("mobile_required").default(false),
  affectsBilling: boolean("affects_billing").default(false),
  scopeLevel: text("scope_level").default("mvp"), // mvp | full
  additionalContext: text("additional_context"),
  status: featureRequestStatusEnum("status").default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const featureDocuments = pgTable("feature_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  featureRequestId: uuid("feature_request_id")
    .notNull()
    .references(() => featureRequests.id, { onDelete: "cascade" }),
  type: featureDocTypeEnum("type").notNull(),
  title: text("title").notNull(),
  status: documentStatusEnum("status").default("pending"),
  content: text("content"),
  wordCount: integer("word_count").default(0),
  aiCreditsUsed: integer("ai_credits_used").default(0).notNull(),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const featureTasks = pgTable("feature_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  featureRequestId: uuid("feature_request_id")
    .notNull()
    .references(() => featureRequests.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: taskStatusEnum("status").default("backlog"),
  priority: taskPriorityEnum("priority").default("medium"),
  phase: text("phase"),
  filesLikelyChanged: jsonb("files_likely_changed"),
  acceptanceCriteria: text("acceptance_criteria"),
  estimatedEffort: text("estimated_effort"),
  securityImpact: text("security_impact"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type RepoConnection = typeof repoConnections.$inferSelect;
export type FeatureRequest = typeof featureRequests.$inferSelect;
export type FeatureDocument = typeof featureDocuments.$inferSelect;
export type FeatureTask = typeof featureTasks.$inferSelect;

// ─── Security Fix Planner ─────────────────────────────────────────────────────

export const securityScanStatusEnum2 = pgEnum("security_scan_status", [
  "pending", "scanning", "analyzed", "generating_prd", "complete", "error",
]);

export const findingConfidenceEnum = pgEnum("finding_confidence", [
  "confirmed",       // Scanner has direct evidence
  "likely_gap",      // Pattern strongly suggests missing protection
  "needs_review",    // Cannot confirm from structure alone
  "recommended",     // Not broken, but should be added
]);

export const findingSeverityEnum = pgEnum("finding_severity", [
  "critical", "high", "medium", "low", "info",
]);

export const securityScans = pgTable("security_scans", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  // Reuse repo connection infra
  repoUrl: text("repo_url"),
  repoOwner: text("repo_owner"),
  repoName: text("repo_name"),
  branch: text("branch").default("main"),
  accessToken: text("access_token"),
  manualContext: text("manual_context"),
  provider: text("provider").default("github"),
  // Detected project info (reused from scanner)
  detectedStack: jsonb("detected_stack"),
  fileTree: jsonb("file_tree"),
  scannedFiles: jsonb("scanned_files"), // { path: content } for high-value files
  appliedPacks: jsonb("applied_packs"),  // which security packs were applied
  // Results
  safeToShipScore: integer("safe_to_ship_score"),
  confirmedCount: integer("confirmed_count").default(0),
  likelyGapCount: integer("likely_gap_count").default(0),
  needsReviewCount: integer("needs_review_count").default(0),
  recommendedCount: integer("recommended_count").default(0),
  // The generated Security Fix PRD content
  prdContent: text("prd_content"),
  agentPrompt: text("agent_prompt"),
  aiCreditsUsed: integer("ai_credits_used").default(0).notNull(),
  status: securityScanStatusEnum2("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const securityFindings = pgTable("security_findings", {
  id: uuid("id").defaultRandom().primaryKey(),
  scanId: uuid("scan_id")
    .notNull()
    .references(() => securityScans.id, { onDelete: "cascade" }),
  pack: text("pack").notNull(),           // which security pack generated this
  title: text("title").notNull(),
  description: text("description").notNull(),
  confidence: findingConfidenceEnum("confidence").notNull(),
  severity: findingSeverityEnum("severity").notNull(),
  affectedFiles: jsonb("affected_files"),  // likely file paths
  recommendation: text("recommendation"),
  codeEvidence: text("code_evidence"),     // what was found in the code
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SecurityScan = typeof securityScans.$inferSelect;
export type SecurityFinding = typeof securityFindings.$inferSelect;

// ─── Engineering Intelligence Engine (EIE) ────────────────────────────────────

export const eieSourceTypeEnum = pgEnum("eie_source_type", [
  "video_upload",
  "video_url",
  "pdf",
  "book",
  "official_doc",
  "github_repo",
  "markdown_file",
  "research_paper",
  "personal_note",
]);

export const eieSourceStatusEnum = pgEnum("eie_source_status", [
  "pending",
  "processing",
  "success",
  "failed",
]);

export const eieSynthesisStatusEnum = pgEnum("eie_synthesis_status", [
  "draft",
  "needs_revision",
  "approved",
  "rejected",
]);

export const eieKnowledgeSources = pgTable("eie_knowledge_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  sourceType: eieSourceTypeEnum("source_type").notNull(),
  sourceUrl: text("source_url"),
  fileKey: text("file_key"),
  rawContent: text("raw_content"),
  status: eieSourceStatusEnum("status").default("pending").notNull(),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata").default({}).notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const eieSynthesisDrafts = pgTable("eie_synthesis_drafts", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: uuid("source_id").references(() => eieKnowledgeSources.id, {
    onDelete: "set null",
  }),
  conceptName: text("concept_name").notNull(),
  category: text("category").notNull(),
  tags: text("tags").array(),
  summary: text("summary").notNull(),
  practicalExplanation: text("practical_explanation").notNull(),
  bestPractices: jsonb("best_practices").notNull(),
  tradeOffs: jsonb("trade_offs").notNull(),
  alternativeApproaches: jsonb("alternative_approaches").notNull(),
  securityConsiderations: jsonb("security_considerations").notNull(),
  commonMistakes: jsonb("common_mistakes").notNull(),
  implementationRecommendations: jsonb("implementation_recommendations").notNull(),
  references: jsonb("references").notNull(),
  status: eieSynthesisStatusEnum("status").default("draft").notNull(),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const eiePublishedKnowledge = pgTable("eie_published_knowledge", {
  id: uuid("id").defaultRandom().primaryKey(),
  synthesisDraftId: uuid("synthesis_draft_id").references(
    () => eieSynthesisDrafts.id,
    { onDelete: "set null" }
  ),
  slug: text("slug").notNull().unique(),
  conceptName: text("concept_name").notNull(),
  category: text("category").notNull(),
  tags: text("tags").array(),
  summary: text("summary").notNull(),
  practicalExplanation: text("practical_explanation").notNull(),
  bestPractices: jsonb("best_practices").notNull(),
  tradeOffs: jsonb("trade_offs").notNull(),
  alternativeApproaches: jsonb("alternative_approaches").notNull(),
  securityConsiderations: jsonb("security_considerations").notNull(),
  commonMistakes: jsonb("common_mistakes").notNull(),
  implementationRecommendations: jsonb("implementation_recommendations").notNull(),
  references: jsonb("references").notNull(),
  viewsCount: integer("views_count").default(0).notNull(),
  embedding: vector("embedding", { dimensions: 1536 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const eieConceptRelationships = pgTable(
  "eie_concept_relationships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceKnowledgeId: uuid("source_knowledge_id")
      .notNull()
      .references(() => eiePublishedKnowledge.id, { onDelete: "cascade" }),
    targetKnowledgeId: uuid("target_knowledge_id")
      .notNull()
      .references(() => eiePublishedKnowledge.id, { onDelete: "cascade" }),
    relationshipType: text("relationship_type").default("related_to").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("unique_concept_relationship_edge").on(
      table.sourceKnowledgeId,
      table.targetKnowledgeId,
      table.relationshipType
    ),
  ]
);

export const eiePrdRetrievals = pgTable("eie_prd_retrievals", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  documentId: uuid("document_id").references(() => documents.id, {
    onDelete: "set null",
  }),
  publishedKnowledgeId: uuid("published_knowledge_id")
    .notNull()
    .references(() => eiePublishedKnowledge.id, { onDelete: "cascade" }),
  relevanceScore: numeric("relevance_score", { precision: 4, scale: 3 }).notNull(),
  retrievedAt: timestamp("retrieved_at").defaultNow().notNull(),
});

export type EieKnowledgeSource = typeof eieKnowledgeSources.$inferSelect;
export type NewEieKnowledgeSource = typeof eieKnowledgeSources.$inferInsert;
export type EieSynthesisDraft = typeof eieSynthesisDrafts.$inferSelect;
export type NewEieSynthesisDraft = typeof eieSynthesisDrafts.$inferInsert;
export type EiePublishedKnowledge = typeof eiePublishedKnowledge.$inferSelect;
export type NewEiePublishedKnowledge = typeof eiePublishedKnowledge.$inferInsert;
export type EieConceptRelationship = typeof eieConceptRelationships.$inferSelect;
export type EiePrdRetrieval = typeof eiePrdRetrievals.$inferSelect;

// Types
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type BuildTask = typeof buildTasks.$inferSelect;
export type NewBuildTask = typeof buildTasks.$inferInsert;
export type SecurityCheck = typeof securityChecks.$inferSelect;
