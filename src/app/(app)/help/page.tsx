import {
  FileText, Shield, Database, GitBranch, Bot, Layers,
  ChevronDown, Map, Palette, Zap, HelpCircle, BookOpen,
  MessageSquare, ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const FAQS = [
  {
    q: "How do I create my first blueprint?",
    a: "Click 'New Blueprint' in the sidebar. Fill in the 5-step wizard — App Identity, Stack Choices, Product Structure, Security Level, and Review. Click 'Generate Blueprint' and the AI will produce all 7 documents automatically.",
  },
  {
    q: "What are the 7 generated documents?",
    a: "PRD (Product Requirements), TRD (Technical Requirements), App Flow (user journeys), UI/UX Design Brief (design direction), Backend Schema (database + API design), Implementation Plan (build phases + tasks), and Security Blueprint (security controls checklist).",
  },
  {
    q: "Which AI model is used for generation?",
    a: "By default, Gemini 2.0 Flash via OpenRouter. You can change this in Settings → AI Model. All models use your OpenRouter API key.",
  },
  {
    q: "Can I regenerate a specific document without redoing everything?",
    a: "Yes. On the Documents page, each card has a 'Regenerate' button. On the document viewer, there is a 'Regenerate' button in the toolbar. This only regenerates that specific document.",
  },
  {
    q: "How do I generate build tasks?",
    a: "First generate the Implementation Plan document. Then go to Build Tasks and click 'Generate from Plan'. The AI will parse the plan and create 15–25 individual tasks on the kanban board.",
  },
  {
    q: "What is the Security Score?",
    a: "The Security Score reflects how many security controls have been enabled for your project. It goes up as you enable more controls in the Security Level step of the wizard and as your Security Blueprint is generated.",
  },
  {
    q: "What is the Blueprint Readiness Score?",
    a: "It's the percentage of your 7 documents that have been generated. 0% means no documents are ready. 100% means all 7 documents are generated. Approved documents also count.",
  },
  {
    q: "Can I connect Cursor, Windsurf, or Claude Code?",
    a: "Agent/IDE integration is Phase 2. Currently, you can export your build tasks and documents and paste them directly into your IDE as context. The Agent Progress page shows your build task completion rate.",
  },
  {
    q: "Why does the app use 'Incorrect email or password' for login errors?",
    a: "This is an intentional security practice. Revealing whether the email or password is wrong tells attackers which emails exist in the system. Generic messages prevent email enumeration attacks.",
  },
  {
    q: "How do I export my documents?",
    a: "Open any document in the Document Viewer and click 'Copy' to copy the full Markdown content to your clipboard. Full PDF/Markdown export bundles are planned for Phase 2.",
  },
];

const DOCS_GUIDE = [
  {
    icon: FileText,
    color: "text-blue-600",
    bg: "bg-blue-50",
    title: "PRD",
    full: "Product Requirements Document",
    desc: "Defines what the app is, who it's for, core features, MVP scope, success metrics, and user stories. Readable by both developers and non-technical stakeholders.",
  },
  {
    icon: FileText,
    color: "text-violet-600",
    bg: "bg-violet-50",
    title: "TRD",
    full: "Technical Requirements Document",
    desc: "Describes how to build the app — architecture, API design, stack choices, scalability, environment variables, testing, and deployment strategy.",
  },
  {
    icon: Map,
    color: "text-cyan-600",
    bg: "bg-cyan-50",
    title: "App Flow",
    full: "App Flow",
    desc: "Maps every user journey — signup, login, password reset, onboarding, dashboard, payments, admin flows. Includes safe error messaging patterns.",
  },
  {
    icon: Palette,
    color: "text-pink-600",
    bg: "bg-pink-50",
    title: "UI/UX Brief",
    full: "UI/UX Design Brief",
    desc: "Design direction, colour palette, typography, component rules, screen-by-screen requirements, accessibility, and mobile/desktop responsiveness rules.",
  },
  {
    icon: Database,
    color: "text-orange-600",
    bg: "bg-orange-50",
    title: "Schema",
    full: "Backend Schema",
    desc: "All database tables, field types, relationships, indexes, RLS policies, API endpoints, and data validation rules. Includes SQL CREATE statements.",
  },
  {
    icon: GitBranch,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    title: "Plan",
    full: "Implementation Plan",
    desc: "Phased build plan with small, agent-sized tasks. Each task includes files affected, acceptance criteria, priority, and estimated effort.",
  },
  {
    icon: Shield,
    color: "text-red-600",
    bg: "bg-red-50",
    title: "Security",
    full: "Security Blueprint",
    desc: "Comprehensive security controls — password hashing, input validation, rate limiting, safe error messages, RBAC, audit logging, and deployment security.",
  },
];

const WORKFLOW = [
  { step: 1, title: "Create Blueprint", desc: "Fill the 5-step wizard with your app idea, stack, and security needs." },
  { step: 2, title: "Generate Documents", desc: "AI generates all 7 build documents from your blueprint input." },
  { step: 3, title: "Review & Approve", desc: "Read each document, edit if needed, and mark as approved." },
  { step: 4, title: "Generate Tasks", desc: "Auto-generate a kanban board of build tasks from your Implementation Plan." },
  { step: 5, title: "Build", desc: "Use the tasks to guide your AI agent or development team. Track progress on the board." },
];

export default function HelpPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Help & Documentation</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Everything you need to get the most out of SkolaTech PRD Studio.</p>
      </div>

      {/* Workflow */}
      <div className="mb-10">
        <h2 className="text-base font-semibold text-foreground mb-4">How it works</h2>
        <div className="grid grid-cols-5 gap-3">
          {WORKFLOW.map(({ step, title, desc }, i) => (
            <div key={step} className="relative">
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center mb-3">
                  {step}
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
              {i < WORKFLOW.length - 1 && (
                <div className="hidden xl:block absolute top-7 -right-1.5 w-3 h-0.5 bg-border z-10" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Document guide */}
      <div className="mb-10">
        <h2 className="text-base font-semibold text-foreground mb-4">The 7 Generated Documents</h2>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {DOCS_GUIDE.map(({ icon: Icon, color, bg, title, full, desc }) => (
            <Card key={title}>
              <CardContent className="p-5">
                <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <p className="font-semibold text-foreground text-sm mb-0.5">{full}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="mb-10">
        <h2 className="text-base font-semibold text-foreground mb-4">Frequently Asked Questions</h2>
        <div className="grid xl:grid-cols-2 gap-3">
          {FAQS.map(({ q, a }) => (
            <details key={q} className="group bg-card border border-border rounded-xl overflow-hidden">
              <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none hover:bg-muted/30 transition-colors">
                <span className="text-sm font-medium text-foreground pr-4">{q}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border pt-3">
                {a}
              </div>
            </details>
          ))}
        </div>
      </div>

      {/* Security principles */}
      <div className="mb-10">
        <h2 className="text-base font-semibold text-foreground mb-4">Security Principles</h2>
        <div className="grid xl:grid-cols-3 gap-4">
          {[
            { title: "Safe Error Messages", desc: "Login failures always say 'Incorrect email or password' — never which one is wrong. Password reset says 'If that email is registered, you'll receive a reset link.'", severity: "Critical" },
            { title: "Password Hashing", desc: "Never store plain text passwords. Use bcrypt or Argon2id with a cost factor. Never log passwords. Compare hashes securely.", severity: "Critical" },
            { title: "Server-side Validation", desc: "Never rely only on frontend validation. All inputs must be validated and sanitised on the server. Use Zod, Joi, Pydantic, or equivalents.", severity: "Critical" },
            { title: "Rate Limiting", desc: "Rate limit login, signup, and password reset routes. Apply progressive delay after failed attempts. Temporarily lock accounts.", severity: "High" },
            { title: "Role-Based Access Control", desc: "Every API route must check the user's role and ownership. Never expose data across accounts. Use RLS policies in your database.", severity: "Critical" },
            { title: "Environment Variables", desc: "Never commit API keys, secrets, or credentials to code. Use .env.local for development. Never expose secrets in client bundles.", severity: "High" },
          ].map(({ title, desc, severity }) => (
            <div key={title} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-red-500" />
                <span className="text-sm font-semibold text-foreground">{title}</span>
                <Badge variant="outline" className={`text-xs ml-auto ${severity === "Critical" ? "text-red-600 border-red-200 bg-red-50" : "text-amber-600 border-amber-200 bg-amber-50"}`}>
                  {severity}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Support links */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-4">Resources</h2>
        <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
          {[
            { icon: BookOpen, title: "OpenRouter Docs", desc: "Browse available AI models and pricing", href: "https://openrouter.ai/docs" },
            { icon: Layers, title: "Clerk Docs", desc: "Auth, user management, and session handling", href: "https://clerk.com/docs" },
            { icon: Database, title: "Neon Docs", desc: "Serverless PostgreSQL setup and branching", href: "https://neon.tech/docs" },
            { icon: Zap, title: "Drizzle ORM", desc: "Type-safe database queries and migrations", href: "https://orm.drizzle.team" },
          ].map(({ icon: Icon, title, desc, href }) => (
            <a
              key={title}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="flex items-start gap-3 bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-colors transition-shadow group"
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
