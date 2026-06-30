export type ProjectContext = {
  appName: string;
  shortDescription: string;
  longDescription?: string;
  appCategory?: string;
  targetUsers?: string;
  problemSolved?: string;
  mainGoal?: string;
  platformType?: string;
  frontendFramework?: string;
  backendFramework?: string;
  database?: string;
  authProvider?: string;
  hostingProvider?: string;
  fileStorage?: string;
  paymentProvider?: string;
  userRoles?: string;
  mainFeatures?: string;
  adminFeatures?: string;
  monetisationModel?: string;
  notificationNeeds?: string;
  integrationNeeds?: string;
  multiTenancy?: boolean;
  fileUpload?: boolean;
  securityLevel?: string;
  securityToggles?: Record<string, boolean>;
};

function baseContext(ctx: ProjectContext) {
  return `
App Name: ${ctx.appName}
Description: ${ctx.shortDescription}
${ctx.longDescription ? `Detailed Description: ${ctx.longDescription}` : ""}
Category: ${ctx.appCategory ?? "Not specified"}
Target Users: ${ctx.targetUsers ?? "Not specified"}
Problem Solved: ${ctx.problemSolved ?? "Not specified"}
Main Goal: ${ctx.mainGoal ?? "Not specified"}
Platform: ${ctx.platformType ?? "Web App"}
Frontend: ${ctx.frontendFramework ?? "Not specified"}
Backend: ${ctx.backendFramework ?? "Not specified"}
Database: ${ctx.database ?? "Not specified"}
Auth: ${ctx.authProvider ?? "Not specified"}
Hosting: ${ctx.hostingProvider ?? "Not specified"}
File Storage: ${ctx.fileStorage ?? "None"}
Payment: ${ctx.paymentProvider ?? "None"}
User Roles: ${ctx.userRoles ?? "Not specified"}
Core Features: ${ctx.mainFeatures ?? "Not specified"}
Admin Features: ${ctx.adminFeatures ?? "Not specified"}
Monetisation: ${ctx.monetisationModel ?? "Not specified"}
Notifications: ${ctx.notificationNeeds ?? "None"}
Integrations: ${ctx.integrationNeeds ?? "None"}
Multi-tenancy: ${ctx.multiTenancy ? "Yes" : "No"}
File Uploads: ${ctx.fileUpload ? "Yes" : "No"}
Security Level: ${ctx.securityLevel ?? "standard"}
`.trim();
}

const EXPORT_SECURITY_REQUIREMENTS = `
Export and download security requirements:
- Every export, download, CSV, PDF, report, or bulk data endpoint must require authentication.
- Every export query must filter by the authenticated user's ownership, role, tenant, or organisation scope.
- A user must never be able to export another user's data by changing an ID, route parameter, query parameter, or filename.
- Exports that include personal, financial, admin, or tenant data must be audit logged.
- Export endpoints must validate requested format, date ranges, filters, and resource IDs server-side.
- Long-running exports must use queued jobs with ownership checks when users fetch the generated file.
- Generated export files must use short-lived signed URLs or server-mediated downloads, not public permanent links.
- Error messages must not reveal whether another user's resource exists.
`.trim();

// Based on the Amospikins "AI Code Security Checklist v2.0" (27 checks, 8 categories).
// Baked into every Security Blueprint so new projects are built with these
// requirements from the start, not bolted on after a scan finds the gap.
function buildAiChecklistRequirements(ctx: ProjectContext) {
  return `
AI Code Security Checklist v2.0 requirements — every item below is mandatory unless explicitly marked optional:

A. Foundations
- Every AI-generated block must be explainable line-by-line before it is accepted (no unexplained copy-paste).
- No real secrets, customer data, or proprietary business logic must ever be pasted into an AI prompt during development.

B. Identity & Access Control
- Passwords hashed with bcrypt (cost 12+) or Argon2id. Tokens expire, sessions rotate, repeated failed logins are rate-limited.
- Authorization is checked on every request, not just authentication — a logged-in user must never reach another user's data, an admin route, or a vendor record by changing an ID.
${ctx.multiTenancy ? "- Multi-tenant data isolation is mandatory: every query must be scoped to the authenticated tenant/owner. Add row-level security or an equivalent ownership filter on every table that holds tenant data." : ""}
- Session and auth tokens are stored in httpOnly, Secure, SameSite cookies — never in localStorage or sessionStorage where any XSS could steal them.

C. Input, Output & Injection
- Every input (forms, APIs, query strings, route params, file uploads, webhooks) is validated server-side for type, length, format, and allowed values.
- Every value rendered back into HTML, attributes, JavaScript, or queries is encoded for that exact context — no unescaped user content via dangerouslySetInnerHTML/v-html.
- All database queries are parameterised or built through an ORM — never by joining user input into a raw query string.
- Any server-side fetch of a URL, image, or webhook target derived from user input must allow-list destinations and block internal/private IP ranges (SSRF protection).
- Request bodies must never be bound wholesale onto a database model. Whitelist exactly which fields each endpoint accepts (no mass assignment of role, isAdmin, balance, vendor_id, etc.).
${ctx.fileUpload ? "- File uploads validate type via magic bytes (not just extension/MIME header), enforce size limits, and never allow execution from the upload folder." : ""}

D. Secrets & Supply Chain
- No API keys, DB passwords, tokens, or .env files ever enter the repository or commit history. Any committed secret must be rotated, not just deleted.
- Every dependency is reviewed for maintenance status and known vulnerabilities before installing.
- Dependencies are pinned (no "*" or "latest"), lockfiles are committed, and package names/sources are verified before install — AI assistants sometimes invent or typosquat package names.

${ctx.paymentProvider && ctx.paymentProvider !== "None" ? `E. Money & Integrations
- Amounts, prices, currency, and payment status are always computed and verified server-side — never trusted from the client. Use idempotency keys so a retried request cannot charge or credit twice.
- Every payment/webhook callback (${ctx.paymentProvider}, etc.) verifies its provider signature before acting on the payload.
- Business rules are enforced explicitly — e.g. a dispatch rider cannot change payment status, a vendor cannot see another vendor's orders.
` : ""}
F. Operations & Hardening
- Rate limiting and abuse protection on login, password reset, OTP, checkout, search, and any public API or AI-prompt endpoint.
- Errors return a safe generic message to the user; full details (stack traces, DB names, file paths, tokens) are logged server-side only, never sent to the client.
- Security-relevant events (failed logins, permission failures, admin actions, payment events) are logged — but passwords, tokens, and full card data are never logged.
- CORS is scoped to an explicit origin allowlist (no wildcard in production), security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options) are set, and any generated token/OTP/secret uses crypto.randomBytes() / crypto.getRandomValues() — never Math.random().

G. AI-Specific Risks
- If this app itself calls an LLM, trusted system instructions must be kept separate from untrusted user content, and any model output that triggers an action must be validated before it runs (prompt injection defence).
- Re-review security after every AI "improve this" / "make it more secure" edit — re-prompting does not guarantee the new version is safer than the last.

H. Verify Before You Ship
- Tests cover abuse cases, not just the happy path: invalid input, missing/expired tokens, wrong roles, tampered IDs, duplicate requests.
- CI runs linting, tests, secret scanning, and dependency/SAST scanning before merge.
- A competent human reviews and approves the code before it reaches production — automated checks alone are not sufficient sign-off.
`.trim();
}

export function buildPrompt(docType: string, ctx: ProjectContext): string {
  const context = baseContext(ctx);

  const prompts: Record<string, string> = {
    prd: `You are an expert product manager. Generate a comprehensive Product Requirements Document (PRD) for the following app.

${context}

The PRD must include these sections with detailed content:
1. Executive Summary
2. Problem Statement
3. Goals & Objectives
4. Target Users & Personas (describe 2-3 detailed personas)
5. Core Features (each feature with full description and acceptance criteria)
6. User Stories (at least 10, in "As a [role], I want to [action] so that [benefit]" format)
7. Non-Functional Requirements
8. MVP Scope vs Future Scope
9. Success Metrics (measurable KPIs)
10. Risks & Dependencies
11. Assumptions & Constraints

Format in clean Markdown with clear headings and subheadings. Be specific and detailed — this document should be ready to hand to a developer or investor.`,

    trd: `You are an expert software architect. Generate a complete Technical Requirements Document (TRD) for the following app.

${context}

The TRD must include these sections:
1. Architecture Overview
2. System Architecture Diagram (as a Mermaid diagram using \`\`\`mermaid graph TD\`\`\` syntax showing frontend, backend, database, third-party services and their connections)
3. Frontend Stack & Component Structure
4. Backend Stack & API Design
5. Database Design Overview
6. Authentication & Session Management
7. Third-party Integrations
8. Environment Variables Required (table with variable name, description, example)
9. API Endpoints Summary (markdown table: Method | Endpoint | Auth Required | Description)
10. Export & Download Endpoint Security
${EXPORT_SECURITY_REQUIREMENTS}
11. Scalability Considerations
12. Performance Requirements
13. Logging & Monitoring Strategy
14. Testing Requirements
15. Deployment Strategy & CI/CD

Format in clean Markdown. Include specific technical recommendations matching the chosen stack.`,

    app_flow: `You are a product designer. Generate a complete App Flow document for the following app.

${context}

The App Flow must include:

1. High-Level User Flow Diagram (Mermaid flowchart using \`\`\`mermaid flowchart TD\`\`\` syntax showing the main paths through the app for each user role)

2. Detailed flows for each journey below. For each flow, describe every step including what the user sees, what they do, and what happens next:
   - Landing / Splash Flow
   - Sign Up Flow (include email verification steps)
   - Sign In Flow (include safe generic error messaging: "Incorrect email or password")
   - Password Reset Flow (response must say "If that email is registered, you'll receive a reset link")
   - Onboarding Flow
   - Main Dashboard Flow
   - Core Feature Flows (one per major feature listed above)
   - Admin Flow
   ${ctx.paymentProvider && ctx.paymentProvider !== "None" ? "   - Payment / Subscription Flow" : ""}
   - Profile & Settings Flow
   - Error States & Empty States

3. Role-based flow differences — what each role can and cannot do

Format in clean Markdown. Each flow should be a numbered step list. Include Mermaid diagrams where helpful for sub-flows.`,

    ux_brief: `You are a senior product designer who builds disciplined design systems. Generate a complete UI/UX Design Brief for the following app.

${context}

## CRITICAL RULES — Violations make the brief useless:

**Colors**
- No default purple gradients unless it is the defined brand color for this app
- Every color must have a specific hex code — no "blue-ish" or "warm neutral"
- Define semantic colors: primary, secondary, accent, surface, border, text, muted-text, error, warning, success, info
- No gradient backgrounds on interactive elements (buttons, cards on hover)
- Hover states: opacity or flat background shift only — no glow, no color explosion

**Typography**
- Define a strict type scale with exact px sizes and font weights — stick to it throughout
- Maximum 4 type sizes for body UI (caption 12px, body 14px, subheading 16px, heading 20-24px)
- No oversized hero headings paired with ultra-thin body text
- Consistent line-height: 1.5 for body, 1.3 for headings
- Heading weight: 600 or 700 — never 900 (black) in UI

**Border Radius**
- Define exactly 2-3 values: small (4-6px), medium (8-10px), large (12-16px)
- Use these consistently — never mix rounded-full on cards with sharp-cornered inputs

**Spacing**
- 8-point grid: all spacing values are multiples of 4px (4, 8, 12, 16, 20, 24, 32, 48)
- No odd values like 7px, 9px, 13px

**Icons**
- Size icons relative to adjacent text: 14px text → 16px icon, 12px text → 14px icon
- Never decorative icons on functional UI elements (no sparkles on submit buttons)
- No emoji in headings, buttons, or nav items

**Hover & Interaction**
- Max 1 elevation step on hover (shadow-sm)
- Max 1px vertical lift on active state
- No scale transforms on hover (no zoom)
- No infinite ambient animations on decorative elements
- All transitions: specify easing curve (e.g. cubic-bezier(0.4, 0, 0.2, 1)) and duration (150ms–300ms)
- Every animation must have a stated purpose

**Loading States — MANDATORY**
- Every async action must have a loading state specified
- Buttons: disabled + spinner during submission
- Data sections: skeleton screens, not blank space
- Never show empty state and loading state at same time

**Copywriting**
- No vague phrases: "Launch faster", "Build your dreams", "Create without limits", "The future of X"
- No em-dash overuse (max 1 per paragraph)
- No fake testimonials or placeholder personas (no "Sarah Chen", "John Smith")
- No invented stats without source
- Button labels: verb + noun ("Save Settings", "Generate Document", "Download Report")
- Empty states: describe what will appear, not inspirational copy

---

## Required Sections:

### 1. Design System (define this FIRST — all other sections reference it)
- Brand personality (3-5 adjectives, emotional tone)
- Color palette (full semantic set with hex codes)
- Type scale (exact sizes, weights, line-heights for each level)
- Spacing system (base unit and scale)
- Border radius values (2-3 only, named: sm/md/lg)
- Elevation/shadow system (3 levels max: none, sm, md)
- Transition system (durations and easing curves for each type)

### 2. Navigation Structure
Mermaid diagram: \`\`\`mermaid graph TD\`\`\` showing full navigation hierarchy

### 3. Component Specifications
For each component, specify: default state, hover state, active state, disabled state, error state
- Primary button, Secondary button, Ghost button, Destructive button
- Text input, Select, Checkbox, Radio, Toggle/Switch
- Card (with and without action)
- Data table (with sorting, pagination)
- Modal/Dialog
- Toast/Notification
- Badge/Chip (semantic variants)
- Skeleton loader
- Empty state (with specific copy guidelines — no inspirational filler)
- Error state

### 4. Screen-by-Screen Specifications
For every screen: layout grid, component placement, data displayed, loading state, empty state, error state.
List every screen in the app.

### 5. Desktop Layout Rules
Grid system, sidebar specs if applicable, content max-width

### 6. Mobile / Responsive Rules
Breakpoints, navigation pattern change, component adaptations

### 7. Accessibility (WCAG 2.1 AA)
Color contrast ratios, focus states, keyboard navigation, ARIA requirements

### 8. Animation Catalogue
Table: Animation name | Element | Trigger | Duration | Easing | Purpose
Only include animations with a clear UX purpose.

Format in clean Markdown. Be precise enough that a developer can implement this without guessing.`,

    backend_schema: `You are a senior database architect. Generate a complete Backend Schema document for the following app.

${context}

The Backend Schema must include:

1. Database Overview & Design Rationale

2. Entity Relationship Diagram (using Mermaid erDiagram syntax):
\`\`\`mermaid
erDiagram
  TABLE_NAME {
    type field_name PK
    type field_name FK
    type field_name
  }
  TABLE_NAME ||--o{ OTHER_TABLE : "relationship"
\`\`\`
Show ALL tables and ALL relationships.

3. Complete Table Definitions (for each table):
   - Table name and purpose
   - All fields with: name | type | constraints | description (as markdown table)
   - Primary keys, foreign keys, unique constraints
   - Indexes

4. API Endpoints (full REST CRUD for each resource):
   - Method | Endpoint | Auth | Request Body | Response (markdown table)

5. Export & Download Data Access
${EXPORT_SECURITY_REQUIREMENTS}

6. Row Level Security (RLS) Policies — for each table, who can SELECT/INSERT/UPDATE/DELETE

7. File Storage Structure (if applicable)

8. Data Validation Rules (per field where important)

9. Seed Data Recommendations

Include SQL CREATE TABLE statements for the 3 most important tables.`,

    implementation_plan: `You are a senior software engineer. Generate a complete Implementation Plan for the following app.

${context}

The Implementation Plan must include:

1. Build Phases Overview (Mermaid Gantt chart showing all phases and estimated duration):
\`\`\`mermaid
gantt
  title ${ctx.appName} Implementation Plan
  dateFormat  YYYY-MM-DD
  section Phase 1 Setup
    Project initialisation :a1, 2024-01-01, 2d
    ...add all phases and tasks with realistic durations
\`\`\`

2. Detailed Phase Breakdown — for each phase:

### Phase N: [Name]
**Goal:** What this phase achieves
**Duration:** Estimated time

| Task | Priority | Effort | Files Affected | Acceptance Criteria |
|------|----------|--------|----------------|---------------------|
| Task description | Critical/High/Medium | 2h | src/... | Criteria |

Include all of these phases:
- Phase 1: Project Setup & Configuration
- Phase 2: Database Schema & Migrations
- Phase 3: Authentication System
- Phase 4: Core UI Layout & Navigation
- Phase 5: Core User Features
- Phase 6: Admin Features
- Phase 7: Security Implementation
- Phase 8: Testing
- Phase 9: Deployment & Launch Checklist

3. Launch Checklist (checkboxes for every item that must be done before go-live)

Format in clean Markdown. Tasks must be small and specific enough for an AI agent to execute one at a time.`,

    security_blueprint: `You are a senior application security engineer. Generate a complete Security Blueprint for the following app.

${context}

Security Level: ${ctx.securityLevel ?? "standard"}
Enabled Controls: ${Object.entries(ctx.securityToggles ?? {}).filter(([, v]) => v).map(([k]) => k).join(", ")}

${buildAiChecklistRequirements(ctx)}

The Security Blueprint must include:

1. Security Overview & Risk Assessment (table: Risk | Likelihood | Impact | Mitigation)

2. Threat Model Diagram (Mermaid flowchart showing attack surfaces and trust boundaries):
\`\`\`mermaid
flowchart TD
  User([User Browser]) --> |HTTPS| LB[Load Balancer / CDN]
  LB --> App[Application Server]
  App --> |Parameterised queries| DB[(Database)]
  App --> |API calls| ThirdParty[Third-party Services]
  Attacker([Attacker]) -.->|Rate limited| LB
  Attacker -.->|Blocked by RBAC| App
\`\`\`
Customise this to the actual app architecture.

3. Authentication Security
   - Password hashing: MUST use bcrypt (cost 12+) or Argon2id. NEVER MD5/SHA1/plain text.
   - Session handling requirements
   - REQUIRED login error message: "Incorrect email or password" (never reveal which is wrong)
   - REQUIRED password reset response: "If that email is registered, you'll receive a reset link"

4. Input Validation & Sanitisation
   - Server-side validation requirements for every input type
   - Schema validation tool recommendation for chosen stack
   - XSS prevention requirements
   - SQL injection prevention

5. Rate Limiting & Account Lockout
   - Which routes need rate limiting (table: Route | Limit | Window | Action)
   - Account lockout thresholds and progressive delay strategy
   - Storage recommendation (Redis / Upstash)

6. Role-Based Access Control
   - Permission matrix (table: Role | Resource | Create | Read | Update | Delete)

7. Export & Download Security
${EXPORT_SECURITY_REQUIREMENTS}

8. API Security Headers (table of all required security headers with values)

9. Database Security
   - RLS policy approach
   - Parameterised query requirement
   - Sensitive field encryption

10. File Upload Security (if applicable)

11. Environment Variable Protection
    - Which variables are secret vs public
    - Never-log list

12. Audit Logging Requirements (table: Event | What to log | Severity)

13. Security Checklist
| Control | Status | Priority | Notes |
|---------|--------|----------|-------|
| Server-side validation | ☐ Todo | Critical | |
| Password hashing (bcrypt/Argon2id) | ☐ Todo | Critical | |
| Safe login error messages | ☐ Todo | Critical | |
| Rate limiting on auth routes | ☐ Todo | High | |
| Account lockout | ☐ Todo | High | |
| RBAC on all API routes | ☐ Todo | Critical | |
| Input sanitisation | ☐ Todo | High | |
| HTTPS enforced | ☐ Todo | Critical | |
| Security headers | ☐ Todo | High | |
| Audit logging | ☐ Todo | Medium | |
| Env vars not in code | ☐ Todo | Critical | |
| Dependency scanning | ☐ Todo | Medium | |
| Export routes authenticated | ☐ Todo | High | |
| Export queries scoped to owner/tenant/role | ☐ Todo | Critical | |
| Sensitive exports audit logged | ☐ Todo | Medium | |
| Output encoding on all rendered user content (XSS) | ☐ Todo | High | |
| SSRF protection on server-side fetches from user input | ☐ Todo | High | |
| Mass assignment guarded — fields whitelisted per endpoint | ☐ Todo | High | |
| Session/JWT stored in httpOnly cookie, not localStorage | ☐ Todo | High | |
| Dependencies pinned, lockfile committed, packages verified | ☐ Todo | Medium | |
| Crypto-safe randomness (crypto.randomBytes) for tokens/OTPs | ☐ Todo | High | |
| CORS scoped to explicit allowlist, no wildcard | ☐ Todo | High | |
${ctx.paymentProvider && ctx.paymentProvider !== "None" ? "| Payment amounts verified server-side, webhook signatures checked | ☐ Todo | Critical | |\n" : ""}| Abuse-case tests (invalid input, wrong role, tampered ID) | ☐ Todo | Medium | |
| CI runs lint, tests, secret + dependency scanning before merge | ☐ Todo | Medium | |
| No real secrets/data pasted into AI prompts during dev | ☐ Todo | Critical | |
| Re-reviewed security after every AI "improve this" edit | ☐ Todo | High | |
| Human code review completed before production | ☐ Todo | Critical | |

14. Recommended Security Libraries for ${ctx.frontendFramework ?? "the chosen stack"}

Format in clean Markdown with all tables and diagrams included.`,
  };

  return prompts[docType] ?? `Generate a detailed ${docType} document for: ${ctx.appName}. Context: ${context}`;
}
