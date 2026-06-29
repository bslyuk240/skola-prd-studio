import type { DetectedStack } from "./github-scanner";

export interface FeatureContext {
  featureName: string;
  featureDescription: string;
  affectedRoles?: string;
  affectsPermissions?: boolean;
  needsNewTables?: boolean;
  needsNotifications?: boolean;
  affectsDashboard?: boolean;
  mobileRequired?: boolean;
  affectsBilling?: boolean;
  scopeLevel?: string;
  additionalContext?: string;
  // Existing project context
  detectedStack?: DetectedStack;
  projectSummary?: string;
  modules?: string[];
  apiRoutes?: string[];
  dbSchemaFiles?: string[];
  fileTreeSample?: string;
  keyFilesContext?: string;
}

function projectContext(ctx: FeatureContext): string {
  const stack = ctx.detectedStack;
  return `
EXISTING PROJECT CONTEXT:
${ctx.projectSummary ? `Project Summary: ${ctx.projectSummary}` : ""}

${stack ? `Tech Stack:
- Framework: ${stack.framework}
- Language: ${stack.language}
- Database: ${stack.database}
- Auth: ${stack.auth}
- UI Library: ${stack.ui}
- State Management: ${stack.stateManagement}
- API Style: ${stack.apiStyle}
- Testing: ${stack.testing}
- Deployment: ${stack.deployment}
- Other: ${stack.otherDeps.join(", ")}` : ""}

${ctx.modules?.length ? `Existing Modules/Pages: ${ctx.modules.join(", ")}` : ""}
${ctx.apiRoutes?.length ? `Existing API Routes (sample): ${ctx.apiRoutes.slice(0, 20).join(", ")}` : ""}
${ctx.dbSchemaFiles?.length ? `Schema Files: ${ctx.dbSchemaFiles.join(", ")}` : ""}

${ctx.keyFilesContext ? `KEY FILE CONTEXT:\n${ctx.keyFilesContext}` : ""}

NEW FEATURE REQUEST:
Feature Name: ${ctx.featureName}
Description: ${ctx.featureDescription}
Affected Roles: ${ctx.affectedRoles ?? "Not specified"}
Affects Permissions: ${ctx.affectsPermissions ? "Yes" : "No"}
Needs New Tables: ${ctx.needsNewTables ? "Yes" : "No"}
Needs Notifications: ${ctx.needsNotifications ? "Yes" : "No"}
Affects Dashboard: ${ctx.affectsDashboard ? "Yes" : "No"}
Mobile Required: ${ctx.mobileRequired ? "Yes" : "No"}
Affects Billing: ${ctx.affectsBilling ? "Yes" : "No"}
Scope: ${ctx.scopeLevel ?? "MVP"}
${ctx.additionalContext ? `Additional Context: ${ctx.additionalContext}` : ""}
`.trim();
}

const FEATURE_EXPORT_REQUIREMENTS = `
Export and download security requirements:
- If this feature adds or changes export, download, CSV, PDF, report, or bulk data functionality, every endpoint must require authentication.
- Every export query must filter by the authenticated user's ownership, role, tenant, or organisation scope.
- Users must not be able to export another user's data by changing an ID, route parameter, query parameter, or filename.
- Sensitive exports must be audit logged with actor, scope, filters, format, and timestamp.
- Validate export format, date ranges, filters, and resource IDs server-side.
- For long-running exports, use queued jobs and re-check ownership before file download.
- Use short-lived signed URLs or server-mediated downloads for generated files.
- Return generic errors that do not reveal whether another user's resource exists.
`.trim();

export function buildFeaturePrompt(docType: string, ctx: FeatureContext): string {
  const context = projectContext(ctx);

  const prompts: Record<string, string> = {

    feature_prd: `You are a senior product manager reviewing an existing codebase. Generate a Feature Requirements Document for adding a new feature to an existing project.

${context}

This is NOT a new project — it is an ADDITION to an existing working system. The document must reflect that.

The Feature PRD must include:

## 1. Feature Overview
- What this feature does
- Why it's needed (problem it solves)
- Who benefits (specific existing user roles)
- Success criteria (measurable)

## 2. Existing System Context
- Which existing modules this feature touches
- Which existing user journeys are affected
- Which existing data this feature reads or writes
- Whether this feature introduces or changes export/download/report flows

## 3. Feature Scope (${ctx.scopeLevel?.toUpperCase() ?? "MVP"})
- What IS included in this delivery
- What is explicitly OUT OF SCOPE (important — prevent scope creep)

## 4. User Stories
At least 8 stories in: "As a [existing role], I want to [action] so that [benefit]"
Reference actual roles from the existing system.

## 5. Functional Requirements
Numbered list, specific and testable.

## 6. Non-Functional Requirements
Performance, accessibility, compatibility with existing system.

## 7. Acceptance Criteria
One per functional requirement. Must be verifiable.

## 8. Dependencies on Existing Features
List every existing feature or data model this depends on.

## 9. Risk of Breaking Existing Functionality
What existing features could regress. How to prevent it.

Format in clean Markdown. Be specific about the existing system — avoid generic advice.`,

    impact_analysis: `You are a senior software architect reviewing an existing codebase. Generate an Impact Analysis for adding a new feature.

${context}

The Impact Analysis must include:

## 1. Feature Impact Summary
One paragraph: what changes and what stays the same.

## 2. Affected System Areas
For each area, describe EXACTLY what changes:

### Existing Pages / Screens
| Page/Screen | Type of Change | What Changes |
|-------------|----------------|--------------|
| (list each affected page) | Modified / Extended / New | Description |

### Existing API Routes
| Route | Method | Change Type | What Changes |
|-------|--------|-------------|--------------|
| (list affected routes) | GET/POST/etc | Modified / Extended / New | Description |

### Existing Database Tables
| Table | Change Type | What Changes |
|-------|-------------|--------------|
| (list affected tables) | Column added / Index added / Queried differently | Description |

### Existing Components
List UI components that need modification.

### Existing Business Logic / Services
List service files, utilities, or middleware that change.

### Existing Auth / Permission Rules
Any changes to who can access what.

## 3. New Items Required
- New pages/screens needed
- New API routes needed
- New database tables needed
- New components needed
- New environment variables needed

## 4. Files Likely to Change
\`\`\`
List specific file paths from the detected project structure that will likely need modification.
Base this on the actual file tree provided.
\`\`\`

## 5. Files That Must NOT Change
List existing files that should be treated as immutable for this feature (to prevent regressions).

## 6. Integration Points
Where the new feature connects to existing system code.

## 7. Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Breaking existing X | Medium | High | Write tests for X before touching it |
(list all risks)

Format in clean Markdown with tables.`,

    schema_changes: `You are a senior database architect. Generate the Backend Schema Changes document for adding a new feature to an existing project.

${context}

This must describe ONLY the changes and additions — not the full existing schema.

## 1. Schema Change Summary
What database changes this feature requires and why.

## 2. New Tables Required
For each new table, provide:
- Purpose
- Full field list as a Markdown table: Field | Type | Constraints | Description
- Relationships to existing tables
- Required indexes
- RLS policies (if applicable)

Also provide SQL CREATE TABLE statements for each new table.

## 3. Changes to Existing Tables
For each existing table that needs modification:
- Table name
- What changes (new columns, new indexes, modified constraints)
- SQL ALTER TABLE statements
- Risk: what existing queries might be affected

## 4. New Database Relationships (ERD additions)
Mermaid erDiagram showing only the NEW tables and their connections to the relevant existing tables:
\`\`\`mermaid
erDiagram
  EXISTING_TABLE {
    uuid id PK
  }
  NEW_TABLE {
    uuid id PK
    uuid existing_table_id FK
    ...
  }
  EXISTING_TABLE ||--o{ NEW_TABLE : "has"
\`\`\`

## 5. Data Migration Plan
- Does existing data need to be migrated or backfilled?
- What is the migration order? (which table first)
- Can migrations run without downtime?
- Rollback plan if migration fails

## 6. New API Endpoints
| Method | Endpoint | Auth Required | Request Body | Response | Notes |
|--------|----------|---------------|--------------|----------|-------|

## 7. Changes to Existing API Endpoints
| Method | Endpoint | What Changes | Backwards Compatible? |
|--------|----------|--------------|----------------------|

Format in clean Markdown with SQL code blocks.`,

    api_changes: `You are a senior backend engineer. Generate the API Changes document for adding a new feature.

${context}

## 1. API Change Overview

## 2. New Endpoints
For each new endpoint, provide:
### POST /api/[route]
- Purpose
- Auth required (role)
- Request body (with types)
- Response format
- Error responses
- Validation rules
- Rate limiting requirements

## 3. Export & Download Endpoints
${FEATURE_EXPORT_REQUIREMENTS}

## 4. Modified Existing Endpoints
For each endpoint that changes:
- What changes and why
- Is it backwards compatible?
- If not: what is the migration strategy?

## 5. Deprecated Endpoints (if any)
What to deprecate and the deprecation timeline.

## 6. Request/Response Examples
Concrete JSON examples for each new endpoint.

## 7. Middleware Changes
Any changes to auth middleware, rate limiting, or validation middleware.

## 8. Error Handling
New error codes and messages for this feature. Must follow existing error format.

Format in clean Markdown with JSON code blocks.`,

    ui_changes: `You are a senior UI/UX designer reviewing an existing system. Generate the UI Changes Plan for adding a new feature.

${context}

This must describe new screens AND changes to existing screens. Reference the detected UI library (${ctx.detectedStack?.ui ?? "detected UI framework"}).

## 1. UI Change Summary

## 2. New Screens Required
For each new screen:
### Screen: [Name]
- Route: /path/to/screen
- Access: which roles can see it
- Layout: describe the layout using existing conventions
- Components needed: list each component
- Data displayed: what the user sees
- Actions available: what the user can do
- Loading state: what shows while data loads
- Empty state: what shows when no data (specific copy — no motivational filler)
- Error state: what shows on failure

## 3. Changes to Existing Screens
| Screen | Route | What Changes | Why |
|--------|-------|--------------|-----|
(list each existing screen that changes)

For each: describe exactly what UI element is added/modified/removed.

## 4. New Components Required
List components that don't exist and need to be built.
For each: purpose, props, states.

## 5. Navigation Changes
Changes to sidebar/nav/menu to accommodate new feature.

## 6. Mobile Considerations
${ctx.mobileRequired ? "Mobile is required for this feature. Describe how each new screen adapts." : "Mobile is not required for MVP. Note any future mobile considerations."}

Format in clean Markdown.`,

    security_checklist: `You are a senior application security engineer. Generate a Security Impact Checklist for adding this feature to an existing project.

${context}

## 1. Security Risk Assessment
What attack surfaces does this feature introduce?

## 2. Authentication & Authorisation
- Who can access new endpoints? (specific roles)
- Are there ownership checks needed? (e.g. user can only see their own data)
- What happens if an unauthorised user tries to access the feature?
- Are there admin-only actions that regular users must not reach?

Critical rules for this feature:
${ctx.affectsPermissions ? "⚠ This feature affects permissions — extra caution required on all access checks." : ""}
- Every new API route must check: is the user authenticated? does the user have the correct role? does the user own this resource?

## 3. Input Validation
For every input in this feature:
| Input Field | Validation Rules | Server-side Required | XSS Risk |
|-------------|-----------------|---------------------|-----------|

## 4. Data Access Rules
- What data can each role read?
- What data can each role write?
- Are there RLS policies needed on new tables?
- Cross-tenant data isolation (if multi-tenant app)

## 5. Rate Limiting
Which new routes need rate limiting and at what thresholds?

## 6. Audit Logging
Which actions in this feature must be logged for compliance/audit?
| Action | What to Log | Severity |
|--------|-------------|----------|

## 7. Export & Download Security
${FEATURE_EXPORT_REQUIREMENTS}

## 8. Notification Security (if applicable)
${ctx.needsNotifications ? "This feature sends notifications. Ensure: no PII in notification previews, verified recipient before sending, rate limit notification sends per user." : "No notifications required."}

## 9. Security Checklist
| Control | Status | Priority | Notes |
|---------|--------|----------|-------|
| Export routes authenticated | ☐ Todo | High | |
| Export queries scoped to owner/tenant/role | ☐ Todo | Critical | |
| Sensitive exports audit logged | ☐ Todo | Medium | |
| Server-side validation on all new inputs | ☐ Todo | Critical | |
| Auth check on all new API routes | ☐ Todo | Critical | |
| Ownership check (user can only act on own data) | ☐ Todo | Critical | |
| RLS policies on new tables | ☐ Todo | Critical | |
| Input sanitisation | ☐ Todo | High | |
| Rate limiting on mutation routes | ☐ Todo | High | |
| Audit logging for sensitive actions | ☐ Todo | Medium | |
| No secrets in API responses | ☐ Todo | Critical | |
| Error messages don't expose internals | ☐ Todo | High | |
| Regression tests on existing auth | ☐ Todo | High | |

Format in clean Markdown with tables.`,

    implementation_tasks: `You are a senior software engineer. Generate the Implementation Task Breakdown for adding this feature.

${context}

Break the implementation into small, specific tasks that an AI coding agent can execute one at a time. Reference the actual file paths and tech stack from the existing project.

## 1. Implementation Gantt
\`\`\`mermaid
gantt
  title ${ctx.featureName} — Implementation Plan
  dateFormat  YYYY-MM-DD
  section Database
    Add new tables/columns :db1, 2024-01-01, 1d
  section Backend
    New API routes :be1, after db1, 2d
  section Frontend
    New screens :fe1, after be1, 3d
  section Testing
    Write tests :t1, after fe1, 2d
\`\`\`
(Use realistic durations based on scope)

## 2. Phase Breakdown

### Phase 1: Database Changes
| Task | Files to Change | Priority | Effort | Acceptance Criteria |
|------|----------------|----------|--------|---------------------|
(specific tasks — reference actual schema file paths from the detected project)

### Phase 2: Backend / API
| Task | Files to Change | Priority | Effort | Acceptance Criteria |
|------|----------------|----------|--------|---------------------|

### Phase 3: Frontend / UI
| Task | Files to Change | Priority | Effort | Acceptance Criteria |
|------|----------------|----------|--------|---------------------|

### Phase 4: Security Implementation
| Task | Files to Change | Priority | Effort | Acceptance Criteria |
|------|----------------|----------|--------|---------------------|
Include export/download authentication, ownership scoping, audit logging, signed URL, and error-message tasks if the feature exposes exports.

### Phase 5: Testing
| Task | Files to Change | Priority | Effort | Acceptance Criteria |
|------|----------------|----------|--------|---------------------|

## 3. Suggested Implementation Order
Numbered list — what to build first and why (dependency order matters).

## 4. Do Not Touch List
Files/modules that should not be modified for this feature to prevent regressions.

Format in clean Markdown with tables.`,

    test_plan: `You are a senior QA engineer. Generate the Test Plan for adding this feature to an existing project.

${context}

## 1. Test Strategy Overview
What types of tests are needed and why.

## 2. Unit Tests
List specific functions/components to unit test.
For each: what to test, what edge cases, what mocks are needed.

## 3. Integration Tests
Test scenarios that involve multiple parts of the system working together.

## 4. API Tests
For each new endpoint:
| Endpoint | Test Case | Expected Result | Auth State |
|----------|-----------|-----------------|------------|

## 5. UI / E2E Tests
Key user journeys to test end-to-end using ${ctx.detectedStack?.testing ?? "your testing framework"}.

## 6. Regression Tests
Existing features that must still work after this change is deployed:
| Existing Feature | Test | Why It Might Break |
|-----------------|------|-------------------|

## 7. Security Tests
| Attack Vector | Test Method | Expected Result |
|---------------|-------------|-----------------|
Include export/download tests for unauthenticated access, cross-user/tenant ID tampering, invalid filters, excessive date ranges, and generated file access after logout or scope changes.

## 8. Export & Download Test Coverage
${FEATURE_EXPORT_REQUIREMENTS}

## 9. Edge Cases
List non-obvious scenarios that must be tested.

## 10. Test Data Requirements
What seed data or fixtures are needed to run tests.

Format in clean Markdown.`,

    deployment_plan: `You are a senior DevOps engineer. Generate the Deployment & Rollback Plan for shipping this feature safely.

${context}

## 1. Pre-Deployment Checklist
- [ ] All tests passing
- [ ] Database migrations reviewed
- [ ] Security checklist complete
- [ ] Feature behind feature flag (if applicable)
- [ ] Rollback plan documented and tested
- [ ] Monitoring alerts configured

## 2. Database Migration Steps
Exact order to run migrations. Can this be done with zero downtime?

## 3. Deployment Steps
Step-by-step deployment sequence for the ${ctx.detectedStack?.deployment ?? "deployment platform"}.

## 4. Environment Variables
New variables needed in production:
| Variable | Purpose | Example Value | Secret? |
|----------|---------|---------------|---------|

## 5. Feature Flag Strategy
Should this feature be released behind a flag? If so:
- Flag name
- Who sees it first (internal, beta users, all users)
- Rollout percentage

## 6. Monitoring & Observability
- What new metrics to watch after deployment
- Error rate thresholds that should trigger rollback
- Performance benchmarks

## 7. Rollback Plan
If the deployment fails or causes issues:
1. How to disable the feature immediately
2. How to roll back database migrations safely
3. What data (if any) might be lost in a rollback
4. Communication plan for affected users

## 8. Post-Deployment Validation
Checklist to run immediately after deployment to verify the feature works in production.

Format in clean Markdown with checkboxes.`,
  };

  return prompts[docType] ?? `Generate a ${docType} document for the feature: ${ctx.featureName}. Context: ${context}`;
}
