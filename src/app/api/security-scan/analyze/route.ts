import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { securityScans, securityFindings, userPreferences } from "@/db/schema";
import { eq } from "drizzle-orm";
import { scanGithubRepo, redactSecrets, type DetectedStack } from "@/lib/github-scanner";
import { runSecurityAnalysis } from "@/lib/security-scanner";
import { buildSecurityPrdPrompt } from "@/lib/security-prd-prompt";
import { generateText, DEFAULT_MODEL } from "@/lib/openrouter";
import { z } from "zod";

const schema = z.object({
  provider: z.enum(["github", "manual"]).default("github"),
  repoUrl: z.string().optional(),
  branch: z.string().optional(),
  accessToken: z.string().optional(),
  manualContext: z.string().optional(),
});

// Files we want to read content from for deep security analysis
const SECURITY_SENSITIVE_FILES = [
  "middleware.ts", "middleware.js",
  "src/middleware.ts", "src/middleware.js",
  "src/app/api/auth", "pages/api/auth",
  "src/lib/auth", "lib/auth",
  "next.config.ts", "next.config.js",
  "package.json",
  ".env.example",
  "cors.ts", "cors.js",
  "src/lib/rate-limit", "lib/rate-limit",
  "SECURITY.md",
];

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { provider, repoUrl, branch = "main", accessToken, manualContext } = parsed.data;

  // Create scan record
  const [scan] = await db.insert(securityScans).values({
    userId,
    repoUrl: repoUrl ?? null,
    branch,
    accessToken: accessToken ?? null,
    manualContext: manualContext ?? null,
    provider,
    status: "scanning",
  }).returning();

  try {
    let paths: string[] = [];
    let fileContent: Record<string, string> = {};
    let detectedStack: DetectedStack | undefined;
    let projectSummary = "";
    let repoDisplayName = "Project";

    if (provider === "github" && repoUrl) {
      const scanResult = await scanGithubRepo(repoUrl, branch, accessToken);
      paths = scanResult.fileTree.map((f) => f.path);
      fileContent = scanResult.keyFilesContent;
      detectedStack = scanResult.detectedStack;
      // Generate project summary via AI
      const summaryCtx = Object.entries(scanResult.keyFilesContent)
        .map(([f, c]) => `--- ${f} ---\n${c}`)
        .join("\n")
        .slice(0, 3000);
      const summaryPrompt = `Summarise this project in 2-3 paragraphs for a security reviewer. Describe what the app does, its architecture, and which areas handle sensitive data or user authentication.\n\n${summaryCtx}`;
      projectSummary = await generateText(summaryPrompt, DEFAULT_MODEL);

      const parts = repoUrl.replace(/^(https?:\/\/)?(www\.)?github\.com\//, "").split("/");
      repoDisplayName = parts.slice(0, 2).join("/");

      await db.update(securityScans).set({
        repoOwner: parts[0],
        repoName: parts[1],
        detectedStack: scanResult.detectedStack,
        fileTree: scanResult.fileTree.slice(0, 300),
        scannedFiles: fileContent,
        updatedAt: new Date(),
      }).where(eq(securityScans.id, scan.id));

    } else {
      // Manual context — build a pseudo stack from the text
      const ctx = manualContext ?? "";
      detectedStack = inferStackFromText(ctx);
      paths = inferPathsFromText(ctx);
      fileContent = { "manual-context.txt": redactSecrets(ctx) };
      projectSummary = ctx.slice(0, 500);
      repoDisplayName = "Your Project";

      await db.update(securityScans).set({
        detectedStack,
        scannedFiles: fileContent,
        updatedAt: new Date(),
      }).where(eq(securityScans.id, scan.id));
    }

    // Run security analysis
    await db.update(securityScans).set({ status: "analyzed", updatedAt: new Date() }).where(eq(securityScans.id, scan.id));
    const { findings, appliedPacks, safeToShipScore } = runSecurityAnalysis(detectedStack!, paths, fileContent);

    // Store findings
    if (findings.length > 0) {
      await db.insert(securityFindings).values(
        findings.map((f) => ({
          scanId: scan.id,
          pack: f.pack,
          title: f.title,
          description: f.description,
          confidence: f.confidence,
          severity: f.severity,
          affectedFiles: f.affectedFiles ?? [],
          recommendation: f.recommendation,
          codeEvidence: f.codeEvidence ?? null,
        }))
      );
    }

    // Update scan with counts
    const confirmed = findings.filter((f) => f.confidence === "confirmed").length;
    const likelyGap = findings.filter((f) => f.confidence === "likely_gap").length;
    const needsReview = findings.filter((f) => f.confidence === "needs_review").length;
    const recommended = findings.filter((f) => f.confidence === "recommended").length;

    await db.update(securityScans).set({
      appliedPacks,
      safeToShipScore,
      confirmedCount: confirmed,
      likelyGapCount: likelyGap,
      needsReviewCount: needsReview,
      recommendedCount: recommended,
      status: "generating_prd",
      updatedAt: new Date(),
    }).where(eq(securityScans.id, scan.id));

    // Generate Security Fix PRD
    const [userPrefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
    const model = userPrefs?.aiModel === "google/gemini-2.0-flash-001"
      ? DEFAULT_MODEL
      : (userPrefs?.aiModel ?? DEFAULT_MODEL);

    const prdPrompt = buildSecurityPrdPrompt(
      repoDisplayName,
      detectedStack,
      findings,
      appliedPacks,
      safeToShipScore,
      projectSummary
    );

    const prdContent = await generateText(prdPrompt, model);

    // Extract the AI agent prompt section from the PRD
    const agentPromptMatch = prdContent.match(/##\s*12\..*?Suggested AI Agent Prompt[\s\S]*?```(?:markdown|text|prompt)?\n([\s\S]*?)```/i);
    const agentPrompt = agentPromptMatch ? agentPromptMatch[1].trim() : "";

    await db.update(securityScans).set({
      prdContent,
      agentPrompt,
      status: "complete",
      updatedAt: new Date(),
    }).where(eq(securityScans.id, scan.id));

    return NextResponse.json({
      scanId: scan.id,
      safeToShipScore,
      confirmedCount: confirmed,
      likelyGapCount: likelyGap,
      needsReviewCount: needsReview,
      recommendedCount: recommended,
      appliedPacks,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[security-scan/analyze]", message);
    await db.update(securityScans).set({ status: "error", updatedAt: new Date() }).where(eq(securityScans.id, scan.id));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function inferStackFromText(text: string) {
  return {
    framework: /next\.?js/i.test(text) ? "Next.js" : /express/i.test(text) ? "Express.js" : /django/i.test(text) ? "Django" : "Unknown",
    language: /typescript/i.test(text) ? "TypeScript" : /python/i.test(text) ? "Python" : "JavaScript",
    database: /supabase/i.test(text) ? "PostgreSQL (Supabase)" : /postgres/i.test(text) ? "PostgreSQL" : /mongo/i.test(text) ? "MongoDB" : "Not detected",
    auth: /clerk/i.test(text) ? "Clerk" : /supabase.*auth/i.test(text) ? "Supabase Auth" : /nextauth/i.test(text) ? "NextAuth.js" : "Not detected",
    ui: /shadcn/i.test(text) ? "shadcn/ui" : /tailwind/i.test(text) ? "Tailwind CSS" : "Not detected",
    stateManagement: "Not detected",
    testing: "Not detected",
    deployment: /vercel/i.test(text) ? "Vercel" : /netlify/i.test(text) ? "Netlify" : "Not detected",
    packageManager: "npm",
    apiStyle: /graphql/i.test(text) ? "GraphQL" : /trpc/i.test(text) ? "tRPC" : "REST",
    otherDeps: (["stripe", "openai", "uploadthing", "resend"] as const).filter((d) => new RegExp(d, "i").test(text)),
  };
}

function inferPathsFromText(text: string): string[] {
  const paths: string[] = [];
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes("/") && (trimmed.includes(".ts") || trimmed.includes(".js") || trimmed.includes(".py"))) {
      const match = trimmed.match(/[\w./\-]+\.(ts|js|tsx|jsx|py|rb)/);
      if (match) paths.push(match[0]);
    }
  }
  return paths;
}
