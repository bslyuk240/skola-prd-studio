import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { securityScans, securityFindings, userPreferences } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateText, DEFAULT_MODEL } from "@/lib/openrouter";

interface Params {
  params: Promise<{ scanId: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  const { scanId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [scan] = await db
    .select()
    .from(securityScans)
    .where(and(eq(securityScans.id, scanId), eq(securityScans.userId, userId)))
    .limit(1);
  if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!scan.prdContent) return NextResponse.json({ error: "Generate the Security Fix PRD first." }, { status: 400 });

  const findings = await db
    .select()
    .from(securityFindings)
    .where(eq(securityFindings.scanId, scanId));

  const [userPrefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  const model = userPrefs?.aiModel === "google/gemini-2.0-flash-001" ? DEFAULT_MODEL : (userPrefs?.aiModel ?? DEFAULT_MODEL);

  const stack = scan.detectedStack as Record<string, string> | null;
  const repoName = scan.repoName ?? scan.repoUrl ?? "Your Project";

  const confirmed = findings.filter((f) => f.confidence === "confirmed");
  const likelyGaps = findings.filter((f) => f.confidence === "likely_gap");
  const allActionable = [...confirmed, ...likelyGaps];

  const prompt = `You are a senior security engineer. Write a precise, implementation-ready AI agent prompt for fixing security issues in an existing project.

PROJECT: ${repoName}
STACK: ${stack ? Object.entries(stack).filter(([k, v]) => k !== "otherDeps" && v && v !== "Not detected").map(([k, v]) => `${k}: ${v}`).join(", ") : "Not detected"}
SAFE TO SHIP SCORE: ${scan.safeToShipScore ?? 0}/100

ISSUES TO FIX (${allActionable.length} actionable items):
${allActionable.map((f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.title}
   ${f.description}
   Fix: ${f.recommendation}
   ${(f.affectedFiles as string[])?.length ? `Files: ${(f.affectedFiles as string[]).join(", ")}` : ""}`).join("\n\n")}

Write a ready-to-paste prompt the developer can give directly to Cursor, Claude Code, or Windsurf. The prompt should:
- Start with context about the project and stack
- List every fix in implementation order (critical first, then high, then medium)
- Be specific about which files to change
- Include the acceptance criteria for each fix
- Reference the actual tech stack so the AI uses the right libraries
- Include constraints: never break existing auth, run tests after each change, commit after each fix
- Be self-contained (the AI receiving this prompt needs no other context)

Output ONLY the agent prompt text, nothing else. No explanation, no preamble. The output should start directly with something like "You are working on..." or "I need you to fix..."`;

  try {
    const agentPrompt = await generateText(prompt, model);

    await db
      .update(securityScans)
      .set({ agentPrompt, updatedAt: new Date() })
      .where(eq(securityScans.id, scanId));

    return NextResponse.json({ agentPrompt });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
