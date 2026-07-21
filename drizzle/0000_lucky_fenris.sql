CREATE TYPE "public"."agent_connection_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."agent_event_type" AS ENUM('task_claimed', 'task_started', 'progress_update', 'files_changed', 'tests_passed', 'tests_failed', 'blocked', 'completed', 'needs_review', 'question_asked');--> statement-breakpoint
CREATE TYPE "public"."agent_session_status" AS ENUM('active', 'completed', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."agent_type" AS ENUM('cursor', 'windsurf', 'claude_code', 'copilot', 'replit', 'other');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('pending', 'generating', 'ready', 'approved', 'needs_revision');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('prd', 'trd', 'app_flow', 'ux_brief', 'backend_schema', 'implementation_plan', 'security_blueprint');--> statement-breakpoint
CREATE TYPE "public"."eie_source_status" AS ENUM('pending', 'processing', 'success', 'failed');--> statement-breakpoint
CREATE TYPE "public"."eie_source_type" AS ENUM('video_upload', 'video_url', 'pdf', 'book', 'official_doc', 'github_repo', 'markdown_file', 'research_paper', 'personal_note');--> statement-breakpoint
CREATE TYPE "public"."eie_synthesis_status" AS ENUM('draft', 'needs_revision', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."feature_doc_type" AS ENUM('feature_prd', 'impact_analysis', 'schema_changes', 'api_changes', 'ui_changes', 'security_checklist', 'implementation_tasks', 'test_plan', 'deployment_plan');--> statement-breakpoint
CREATE TYPE "public"."feature_request_status" AS ENUM('draft', 'generating', 'ready', 'approved');--> statement-breakpoint
CREATE TYPE "public"."finding_confidence" AS ENUM('confirmed', 'likely_gap', 'needs_review', 'recommended');--> statement-breakpoint
CREATE TYPE "public"."finding_severity" AS ENUM('critical', 'high', 'medium', 'low', 'info');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'generating', 'review', 'approved', 'building');--> statement-breakpoint
CREATE TYPE "public"."repo_connection_status" AS ENUM('pending', 'scanning', 'ready', 'error');--> statement-breakpoint
CREATE TYPE "public"."security_scan_status" AS ENUM('pending', 'scanning', 'analyzed', 'generating_prd', 'complete', 'error');--> statement-breakpoint
CREATE TYPE "public"."security_severity" AS ENUM('info', 'low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."security_status" AS ENUM('pending', 'implemented', 'needs_review', 'not_applicable');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('backlog', 'ready', 'in_progress', 'review', 'done', 'blocked');--> statement-breakpoint
CREATE TABLE "agent_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"agent_type" "agent_type" DEFAULT 'other' NOT NULL,
	"connection_name" text NOT NULL,
	"status" "agent_connection_status" DEFAULT 'active' NOT NULL,
	"token_hash" text NOT NULL,
	"scopes" jsonb DEFAULT '["read:context","write:progress"]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	CONSTRAINT "agent_connections_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "agent_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"agent_session_id" uuid,
	"task_id" uuid,
	"event_type" "agent_event_type" NOT NULL,
	"message" text,
	"status" text,
	"files_changed" jsonb,
	"test_result" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"agent_session_id" uuid,
	"question" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"answer" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"answered_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "agent_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"agent_type" "agent_type" NOT NULL,
	"agent_connection_id" uuid,
	"status" "agent_session_status" DEFAULT 'active' NOT NULL,
	"connection_status" text DEFAULT 'disconnected',
	"current_task_id" uuid,
	"started_at" timestamp DEFAULT now(),
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "build_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'backlog',
	"priority" "task_priority" DEFAULT 'medium',
	"phase" text,
	"related_document_id" uuid,
	"acceptance_criteria" text,
	"security_impact" text,
	"estimated_effort" text,
	"dependencies" jsonb,
	"files_affected" jsonb,
	"agent_status" text,
	"notes" text,
	"is_approved_for_agent" boolean DEFAULT false NOT NULL,
	"assigned_connection_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"type" "document_type" NOT NULL,
	"title" text NOT NULL,
	"status" "document_status" DEFAULT 'pending',
	"content" text,
	"word_count" integer DEFAULT 0,
	"ai_credits_used" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eie_concept_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_knowledge_id" uuid NOT NULL,
	"target_knowledge_id" uuid NOT NULL,
	"relationship_type" text DEFAULT 'related_to' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_concept_relationship_edge" UNIQUE("source_knowledge_id","target_knowledge_id","relationship_type")
);
--> statement-breakpoint
CREATE TABLE "eie_knowledge_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"source_type" "eie_source_type" NOT NULL,
	"source_url" text,
	"file_key" text,
	"raw_content" text,
	"status" "eie_source_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eie_prd_retrievals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"document_id" uuid,
	"published_knowledge_id" uuid NOT NULL,
	"relevance_score" numeric(4, 3) NOT NULL,
	"retrieved_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eie_published_knowledge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"synthesis_draft_id" uuid,
	"slug" text NOT NULL,
	"concept_name" text NOT NULL,
	"category" text NOT NULL,
	"tags" text[],
	"summary" text NOT NULL,
	"practical_explanation" text NOT NULL,
	"best_practices" jsonb NOT NULL,
	"trade_offs" jsonb NOT NULL,
	"alternative_approaches" jsonb NOT NULL,
	"security_considerations" jsonb NOT NULL,
	"common_mistakes" jsonb NOT NULL,
	"implementation_recommendations" jsonb NOT NULL,
	"references" jsonb NOT NULL,
	"views_count" integer DEFAULT 0 NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "eie_published_knowledge_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "eie_synthesis_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid,
	"concept_name" text NOT NULL,
	"category" text NOT NULL,
	"tags" text[],
	"summary" text NOT NULL,
	"practical_explanation" text NOT NULL,
	"best_practices" jsonb NOT NULL,
	"trade_offs" jsonb NOT NULL,
	"alternative_approaches" jsonb NOT NULL,
	"security_considerations" jsonb NOT NULL,
	"common_mistakes" jsonb NOT NULL,
	"implementation_recommendations" jsonb NOT NULL,
	"references" jsonb NOT NULL,
	"status" "eie_synthesis_status" DEFAULT 'draft' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"export_type" text NOT NULL,
	"file_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature_request_id" uuid NOT NULL,
	"type" "feature_doc_type" NOT NULL,
	"title" text NOT NULL,
	"status" "document_status" DEFAULT 'pending',
	"content" text,
	"word_count" integer DEFAULT 0,
	"ai_credits_used" integer DEFAULT 0 NOT NULL,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"repo_connection_id" uuid,
	"feature_name" text NOT NULL,
	"feature_description" text NOT NULL,
	"affected_roles" text,
	"affects_permissions" boolean DEFAULT false,
	"needs_new_tables" boolean DEFAULT false,
	"needs_notifications" boolean DEFAULT false,
	"affects_dashboard" boolean DEFAULT false,
	"mobile_required" boolean DEFAULT false,
	"affects_billing" boolean DEFAULT false,
	"scope_level" text DEFAULT 'mvp',
	"additional_context" text,
	"status" "feature_request_status" DEFAULT 'draft',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature_request_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'backlog',
	"priority" "task_priority" DEFAULT 'medium',
	"phase" text,
	"files_likely_changed" jsonb,
	"acceptance_criteria" text,
	"estimated_effort" text,
	"security_impact" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_inputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" text,
	"category" text,
	"is_required" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"app_type" text,
	"platform" text,
	"stack_preferences" jsonb,
	"security_level" text DEFAULT 'standard',
	"status" "project_status" DEFAULT 'draft',
	"readiness_score" integer DEFAULT 0,
	"security_score" integer DEFAULT 0,
	"agent_readiness_score" integer DEFAULT 0,
	"wizard_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repo_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"repo_url" text NOT NULL,
	"repo_owner" text,
	"repo_name" text,
	"branch" text DEFAULT 'main',
	"provider" text DEFAULT 'github',
	"is_private" boolean DEFAULT false,
	"access_token" text,
	"status" "repo_connection_status" DEFAULT 'pending',
	"detected_stack" jsonb,
	"file_tree" jsonb,
	"key_files_content" jsonb,
	"project_summary" text,
	"last_scanned_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"severity" "security_severity" DEFAULT 'medium',
	"status" "security_status" DEFAULT 'pending',
	"recommendation" text,
	"related_task_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"pack" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"confidence" "finding_confidence" NOT NULL,
	"severity" "finding_severity" NOT NULL,
	"affected_files" jsonb,
	"recommendation" text,
	"code_evidence" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"repo_url" text,
	"repo_owner" text,
	"repo_name" text,
	"branch" text DEFAULT 'main',
	"access_token" text,
	"manual_context" text,
	"provider" text DEFAULT 'github',
	"detected_stack" jsonb,
	"file_tree" jsonb,
	"scanned_files" jsonb,
	"applied_packs" jsonb,
	"safe_to_ship_score" integer,
	"confirmed_count" integer DEFAULT 0,
	"likely_gap_count" integer DEFAULT 0,
	"needs_review_count" integer DEFAULT 0,
	"recommended_count" integer DEFAULT 0,
	"prd_content" text,
	"agent_prompt" text,
	"ai_credits_used" integer DEFAULT 0 NOT NULL,
	"status" "security_scan_status" DEFAULT 'pending',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"ai_model" text DEFAULT 'google/gemini-2.0-flash-001',
	"default_security_level" text DEFAULT 'standard',
	"default_security_toggles" jsonb,
	"word_count_visible" boolean DEFAULT true,
	"auto_refresh" boolean DEFAULT true,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_connections" ADD CONSTRAINT "agent_connections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_logs" ADD CONSTRAINT "agent_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_logs" ADD CONSTRAINT "agent_logs_agent_session_id_agent_sessions_id_fk" FOREIGN KEY ("agent_session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_questions" ADD CONSTRAINT "agent_questions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_questions" ADD CONSTRAINT "agent_questions_agent_session_id_agent_sessions_id_fk" FOREIGN KEY ("agent_session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_agent_connection_id_agent_connections_id_fk" FOREIGN KEY ("agent_connection_id") REFERENCES "public"."agent_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_tasks" ADD CONSTRAINT "build_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eie_concept_relationships" ADD CONSTRAINT "eie_concept_relationships_source_knowledge_id_eie_published_knowledge_id_fk" FOREIGN KEY ("source_knowledge_id") REFERENCES "public"."eie_published_knowledge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eie_concept_relationships" ADD CONSTRAINT "eie_concept_relationships_target_knowledge_id_eie_published_knowledge_id_fk" FOREIGN KEY ("target_knowledge_id") REFERENCES "public"."eie_published_knowledge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eie_prd_retrievals" ADD CONSTRAINT "eie_prd_retrievals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eie_prd_retrievals" ADD CONSTRAINT "eie_prd_retrievals_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eie_prd_retrievals" ADD CONSTRAINT "eie_prd_retrievals_published_knowledge_id_eie_published_knowledge_id_fk" FOREIGN KEY ("published_knowledge_id") REFERENCES "public"."eie_published_knowledge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eie_published_knowledge" ADD CONSTRAINT "eie_published_knowledge_synthesis_draft_id_eie_synthesis_drafts_id_fk" FOREIGN KEY ("synthesis_draft_id") REFERENCES "public"."eie_synthesis_drafts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eie_synthesis_drafts" ADD CONSTRAINT "eie_synthesis_drafts_source_id_eie_knowledge_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."eie_knowledge_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exports" ADD CONSTRAINT "exports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_documents" ADD CONSTRAINT "feature_documents_feature_request_id_feature_requests_id_fk" FOREIGN KEY ("feature_request_id") REFERENCES "public"."feature_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_requests" ADD CONSTRAINT "feature_requests_repo_connection_id_repo_connections_id_fk" FOREIGN KEY ("repo_connection_id") REFERENCES "public"."repo_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_tasks" ADD CONSTRAINT "feature_tasks_feature_request_id_feature_requests_id_fk" FOREIGN KEY ("feature_request_id") REFERENCES "public"."feature_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_inputs" ADD CONSTRAINT "project_inputs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_checks" ADD CONSTRAINT "security_checks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_findings" ADD CONSTRAINT "security_findings_scan_id_security_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."security_scans"("id") ON DELETE cascade ON UPDATE no action;