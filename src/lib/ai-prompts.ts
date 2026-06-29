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
10. Scalability Considerations
11. Performance Requirements
12. Logging & Monitoring Strategy
13. Testing Requirements
14. Deployment Strategy & CI/CD

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

5. Row Level Security (RLS) Policies — for each table, who can SELECT/INSERT/UPDATE/DELETE

6. File Storage Structure (if applicable)

7. Data Validation Rules (per field where important)

8. Seed Data Recommendations

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

7. API Security Headers (table of all required security headers with values)

8. Database Security
   - RLS policy approach
   - Parameterised query requirement
   - Sensitive field encryption

9. File Upload Security (if applicable)

10. Environment Variable Protection
    - Which variables are secret vs public
    - Never-log list

11. Audit Logging Requirements (table: Event | What to log | Severity)

12. Security Checklist
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

13. Recommended Security Libraries for ${ctx.frontendFramework ?? "the chosen stack"}

Format in clean Markdown with all tables and diagrams included.`,
  };

  return prompts[docType] ?? `Generate a detailed ${docType} document for: ${ctx.appName}. Context: ${context}`;
}
