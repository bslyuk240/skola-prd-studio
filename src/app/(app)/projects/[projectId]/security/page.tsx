import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects, documents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Shield, CheckCircle2, AlertTriangle, XCircle, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn, scoreColor } from "@/lib/utils";

const SECURITY_CATEGORIES = [
  {
    category: "Authentication",
    items: [
      { title: "Password Hashing", desc: "Use bcrypt or Argon2id — never plain text", severity: "critical" },
      { title: "Safe Error Messages", desc: '"Incorrect email or password" — never reveal which is wrong', severity: "critical" },
      { title: "Secure Session Handling", desc: "HttpOnly cookies, session rotation on login", severity: "high" },
      { title: "Email Verification", desc: "Verify email before granting full access", severity: "medium" },
    ],
  },
  {
    category: "Input Security",
    items: [
      { title: "Server-side Validation", desc: "Never rely only on frontend validation", severity: "critical" },
      { title: "Input Sanitisation", desc: "Strip HTML, scripts, and dangerous characters", severity: "high" },
      { title: "SQL Injection Prevention", desc: "Use parameterised queries / ORM only", severity: "critical" },
      { title: "XSS Prevention", desc: "Sanitise user-generated content before rendering", severity: "high" },
    ],
  },
  {
    category: "Rate Limiting & Lockout",
    items: [
      { title: "Login Rate Limiting", desc: "Limit failed login attempts per IP and account", severity: "high" },
      { title: "Signup Rate Limiting", desc: "Prevent account creation spam", severity: "medium" },
      { title: "Password Reset Limiting", desc: "Rate limit reset email requests", severity: "high" },
      { title: "Account Lockout", desc: "Progressive delay or temporary lockout after failures", severity: "high" },
    ],
  },
  {
    category: "Access Control",
    items: [
      { title: "Role-Based Access Control", desc: "Every route and API enforces role permissions", severity: "critical" },
      { title: "API Authorization", desc: "All endpoints check user ownership and role", severity: "critical" },
      { title: "Audit Logging", desc: "Log login, data access, permission changes", severity: "medium" },
    ],
  },
  {
    category: "Infrastructure",
    items: [
      { title: "Environment Variables", desc: "No secrets in code, client bundles, or repos", severity: "critical" },
      { title: "HTTPS Only", desc: "Force HTTPS in production", severity: "high" },
      { title: "Dependency Scanning", desc: "Regularly check for vulnerable packages", severity: "medium" },
    ],
  },
];

const SEVERITY_CONFIG = {
  critical: { label: "Critical", className: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
  high: { label: "High", className: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertTriangle },
  medium: { label: "Medium", className: "bg-blue-100 text-blue-700 border-blue-200", icon: AlertTriangle },
};

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function SecurityPage({ params }: Props) {
  const { projectId } = await params;
  const { userId } = await auth();
  if (!userId) return null;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  if (!project) notFound();

  const securityDoc = await db
    .select()
    .from(documents)
    .where(and(eq(documents.projectId, projectId), eq(documents.type, "security_blueprint")))
    .limit(1);

  const score = project.securityScore ?? 0;
  const totalItems = SECURITY_CATEGORIES.reduce((s, c) => s + c.items.length, 0);
  const criticalItems = SECURITY_CATEGORIES.flatMap((c) => c.items).filter((i) => i.severity === "critical").length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href={`/projects/${projectId}/documents`}>
              <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
                <ArrowLeft className="w-4 h-4" /> Documents
              </Button>
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Security Center</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{project.name} — Security Review</p>
        </div>
        {securityDoc[0]?.id && (
          <Link href={`/projects/${projectId}/documents/${securityDoc[0].id}`}>
            <Button variant="outline" className="gap-2">
              <Shield className="w-4 h-4" />
              View Security Blueprint
            </Button>
          </Link>
        )}
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        <Card className="col-span-1">
          <CardContent className="p-5 flex flex-col items-center text-center">
            <div className={cn("text-4xl font-bold mb-2", scoreColor(score))}>{score}</div>
            <p className="text-sm font-medium text-foreground mb-1">Security Score</p>
            <Progress value={score} className="w-full h-2 mb-2" />
            <p className="text-xs text-muted-foreground">{score < 60 ? "Needs Review" : score < 80 ? "Good" : "Strong"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Total Controls</p>
            <p className="text-3xl font-bold text-foreground">{totalItems}</p>
            <p className="text-xs text-muted-foreground mt-1">Security requirements identified</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Critical Items</p>
            <p className="text-3xl font-bold text-red-600">{criticalItems}</p>
            <p className="text-xs text-muted-foreground mt-1">Must be implemented before launch</p>
          </CardContent>
        </Card>
      </div>

      {/* Security categories */}
      <div className="grid xl:grid-cols-2 gap-6">
        {SECURITY_CATEGORIES.map(({ category, items }) => (
          <Card key={category}>
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                {category}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="space-y-2">
                {items.map(({ title, desc, severity }) => {
                  const cfg = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG];
                  const Icon = cfg.icon;
                  return (
                    <div key={title} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                      <Icon className={cn("w-4 h-4 shrink-0", severity === "critical" ? "text-red-500" : severity === "high" ? "text-amber-500" : "text-blue-500")} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{title}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                      <Badge variant="outline" className={cn("text-xs shrink-0", cfg.className)}>
                        {cfg.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
