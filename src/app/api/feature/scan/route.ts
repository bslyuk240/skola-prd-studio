import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { repoConnections } from "@/db/schema";
import { scanGithubRepo } from "@/lib/github-scanner";
import { generateText, DEFAULT_MODEL } from "@/lib/openrouter";
import { z } from "zod";

const schema = z.object({
  repoUrl: z.string().min(1),
  branch: z.string().optional(),
  accessToken: z.string().optional(),
  // Manual paste fallback
  manualContext: z.string().optional(),
  provider: z.enum(["github", "manual"]).default("github"),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { repoUrl, branch = "main", accessToken, manualContext, provider } = parsed.data;

  // Create repo connection record
  const [conn] = await db.insert(repoConnections).values({
    userId,
    repoUrl,
    branch,
    provider,
    isPrivate: !!accessToken,
    accessToken: accessToken ?? null,
    status: "scanning",
  }).returning();

  try {
    let scanResult;
    let keyFilesContext = "";

    if (provider === "github") {
      scanResult = await scanGithubRepo(repoUrl, branch, accessToken);

      // Build key files context for AI (cap at 6000 chars total)
      const contextParts: string[] = [];
      let charCount = 0;
      for (const [file, content] of Object.entries(scanResult.keyFilesContent)) {
        const part = `\n--- ${file} ---\n${content}`;
        if (charCount + part.length > 6000) break;
        contextParts.push(part);
        charCount += part.length;
      }
      keyFilesContext = contextParts.join("\n");

      // Parse owner/repo from URL
      const parts = repoUrl.replace(/^(https?:\/\/)?(www\.)?github\.com\//, "").replace(/\.git$/, "").split("/");

      // Generate AI project summary
      const summaryPrompt = `Analyse this project's detected information and write a concise 2-3 paragraph summary suitable for a developer who wants to add a feature to it. Describe what the app does, its architecture, key modules, and any important patterns or conventions.

Tech Stack: ${JSON.stringify(scanResult.detectedStack)}
Modules/Pages: ${scanResult.modules.join(", ")}
API Routes (sample): ${scanResult.apiRoutes.slice(0, 15).join(", ")}
Schema Files: ${scanResult.dbSchemaFiles.join(", ")}

Key file excerpts:
${keyFilesContext.slice(0, 3000)}

Write 2-3 focused paragraphs. No bullet points. Be specific about what you see in the code.`;

      const projectSummary = await generateText(summaryPrompt, DEFAULT_MODEL);

      await db.update(repoConnections).set({
        repoOwner: parts[0],
        repoName: parts[1],
        detectedStack: scanResult.detectedStack,
        fileTree: scanResult.fileTree.slice(0, 300),
        keyFilesContent: scanResult.keyFilesContent,
        projectSummary,
        status: "ready",
        lastScannedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(repoConnections.id, conn.id));

      return NextResponse.json({
        connectionId: conn.id,
        detectedStack: scanResult.detectedStack,
        modules: scanResult.modules,
        apiRoutes: scanResult.apiRoutes,
        dbSchemaFiles: scanResult.dbSchemaFiles,
        fileCount: scanResult.fileTree.length,
        projectSummary,
      });
    } else {
      // Manual context
      const summaryPrompt = `Based on this pasted project context, write a 2-3 paragraph summary of the project for a developer who wants to add a feature to it.

${manualContext ?? "No context provided."}

Write 2-3 focused paragraphs about what this project is and how it's structured.`;

      const projectSummary = await generateText(summaryPrompt, DEFAULT_MODEL);

      await db.update(repoConnections).set({
        projectSummary,
        keyFilesContent: { manual: manualContext ?? "" },
        status: "ready",
        lastScannedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(repoConnections.id, conn.id));

      return NextResponse.json({ connectionId: conn.id, projectSummary });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[feature/scan]", message);
    await db.update(repoConnections).set({ status: "error", updatedAt: new Date() }).where(eq(repoConnections.id, conn.id));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Needed import
import { eq } from "drizzle-orm";
