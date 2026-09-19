import { db } from "@/db";
import { securityScans, securityFindings, userPreferences, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { scanGithubRepo, redactSecrets, type DetectedStack } from "@/lib/github-scanner";
import { runSecurityAnalysis } from "@/lib/security-scanner";
import { buildSecurityPrdPrompt } from "@/lib/security-prd-prompt";
import { generateText, DEFAULT_MODEL } from "@/lib/openrouter";
import { SECURITY_SCAN_CREDITS } from "@/lib/credits";
import {
  assignRemediationRequirementIds,
  buildSecurityScanModel,
} from "@/lib/blueprint-engine/plan/security-remediation-planner";
import {
  getLinkedProjectBlueprintForScan,
  getProjectSecurityBlueprintContent,
  validateSecurityFixPrd,
} from "@/lib/blueprint-engine/security-scan-service";

export interface RunSecurityScanInput {
  userId: string;
  provider: "github" | "manual";
  repoUrl?: string;
  branch?: string;
  accessToken?: string;
  manualContext?: string;
  projectId?: string;
}

export interface RunSecurityScanResult {
  scanId: string;
  safeToShipScore: number;
  confirmedCount: number;
  likelyGapCount: number;
  needsReviewCount: number;
  recommendedCount: number;
  appliedPacks: string[];
  validationStatus: string;
  validationWarnings: number;
  missingConfirmedFindings: string[];
}

export type RunSecurityScanOutcome =
  | { ok: true; result: RunSecurityScanResult }
  | { ok: false; status: 404; error: string }
  | { ok: false; status: 500; error: string; scanId?: string };

/** Runs a full security scan + Security Fix PRD generation. Shared by the app route and the MCP connector. */
export async function runSecurityScan(input: RunSecurityScanInput): Promise<RunSecurityScanOutcome> {
  const { userId, provider, repoUrl, branch = "main", accessToken, manualContext, projectId } = input;

  if (projectId) {
    const [linkedProject] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);
    if (!linkedProject) return { ok: false, status: 404, error: "Linked project not found" };
  }

  const [scan] = await db
    .insert(securityScans)
    .values({
      userId,
      projectId: projectId ?? null,
      repoUrl: repoUrl ?? null,
      branch,
      accessToken: accessToken ?? null,
      manualContext: manualContext ?? null,
      provider,
      status: "scanning",
    })
    .returning();

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

    await db.update(securityScans).set({ status: "analyzed", updatedAt: new Date() }).where(eq(securityScans.id, scan.id));
    const { findings, appliedPacks, safeToShipScore } = runSecurityAnalysis(detectedStack!, paths, fileContent);
    const findingsWithIds = assignRemediationRequirementIds(findings);
    const scanModel = buildSecurityScanModel(findingsWithIds, safeToShipScore, projectId ?? null);

    if (findingsWithIds.length > 0) {
      await db.insert(securityFindings).values(
        findingsWithIds.map((f) => ({
          scanId: scan.id,
          pack: f.pack,
          remediationRequirementId: f.remediationRequirementId,
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
      securityScanModel: scanModel,
      status: "generating_prd",
      updatedAt: new Date(),
    }).where(eq(securityScans.id, scan.id));

    const [userPrefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
    const model = userPrefs?.aiModel === "google/gemini-2.0-flash-001"
      ? DEFAULT_MODEL
      : (userPrefs?.aiModel ?? DEFAULT_MODEL);

    const prdPrompt = buildSecurityPrdPrompt(
      repoDisplayName,
      detectedStack!,
      findingsWithIds,
      appliedPacks,
      safeToShipScore,
      projectSummary,
      scanModel
    );

    const prdContent = await generateText(prdPrompt, model);

    const agentPromptMatch = prdContent.match(/##\s*12\..*?Suggested AI Agent Prompt[\s\S]*?```(?:markdown|text|prompt)?\n([\s\S]*?)```/i);
    const agentPrompt = agentPromptMatch ? agentPromptMatch[1].trim() : "";

    const linkedBlueprint = await getLinkedProjectBlueprintForScan(projectId ?? null, userId);
    const securityBlueprintContent = projectId
      ? await getProjectSecurityBlueprintContent(projectId)
      : null;
    const validationReport = validateSecurityFixPrd(
      scanModel,
      prdContent,
      linkedBlueprint,
      securityBlueprintContent
    );

    await db.update(securityScans).set({
      prdContent,
      agentPrompt,
      validationReport,
      aiCreditsUsed: SECURITY_SCAN_CREDITS,
      status: "complete",
      updatedAt: new Date(),
    }).where(eq(securityScans.id, scan.id));

    return {
      ok: true,
      result: {
        scanId: scan.id,
        safeToShipScore,
        confirmedCount: confirmed,
        likelyGapCount: likelyGap,
        needsReviewCount: needsReview,
        recommendedCount: recommended,
        appliedPacks,
        validationStatus: validationReport.status,
        validationWarnings: validationReport.warningCount,
        missingConfirmedFindings: validationReport.confirmedCoverage.missingRequirementIds,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[security-scan-runner]", message);
    await db.update(securityScans).set({ status: "error", updatedAt: new Date() }).where(eq(securityScans.id, scan.id));
    return { ok: false, status: 500, error: message, scanId: scan.id };
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
