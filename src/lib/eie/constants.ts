/** Canonical EIE enum values — mirror PostgreSQL enums in src/db/schema.ts */

export const EIE_SOURCE_TYPES = [
  "video_upload",
  "video_url",
  "pdf",
  "book",
  "official_doc",
  "github_repo",
  "markdown_file",
  "research_paper",
  "personal_note",
] as const;

export type EieSourceType = (typeof EIE_SOURCE_TYPES)[number];

export const EIE_SOURCE_STATUSES = [
  "pending",
  "processing",
  "success",
  "failed",
] as const;

export type EieSourceStatus = (typeof EIE_SOURCE_STATUSES)[number];

export const EIE_SYNTHESIS_STATUSES = [
  "draft",
  "needs_revision",
  "approved",
  "rejected",
] as const;

export type EieSynthesisStatus = (typeof EIE_SYNTHESIS_STATUSES)[number];

export const EIE_CATEGORIES = [
  "architecture",
  "security_compliance",
  "database_persistence",
  "scaling_performance",
  "microservices_event_driven",
  "frontend_ux_patterns",
  "api_design",
  "devops_deployment",
] as const;

export type EieCategory = (typeof EIE_CATEGORIES)[number];

export const EIE_ADMIN_ROLES = ["admin", "platform_admin"] as const;

export type EieAdminRole = (typeof EIE_ADMIN_ROLES)[number];

export const EIE_RELATIONSHIP_TYPES = [
  "related_to",
  "extends",
  "prerequisite",
] as const;

export type EieRelationshipType = (typeof EIE_RELATIONSHIP_TYPES)[number];

export const EIE_EMBEDDING_DIMENSIONS = 1536;

export function formatEieCategory(category: string): string {
  return category.replace(/_/g, " ");
}
