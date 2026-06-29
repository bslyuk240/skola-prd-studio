import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, documents, buildTasks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateText } from "@/lib/openrouter";

interface Params {
  params: Promise<{ projectId: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [implDoc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.projectId, projectId), eq(documents.type, "implementation_plan")))
    .limit(1);

  if (!implDoc?.content) {
    return NextResponse.json({ error: "Generate the Implementation Plan document first." }, { status: 400 });
  }

  const prompt = `Based on this Implementation Plan, extract a JSON array of build tasks.

IMPLEMENTATION PLAN:
${implDoc.content.slice(0, 6000)}

Return ONLY a valid JSON array (no markdown, no explanation) with objects having these fields:
- title: string (short, imperative)
- description: string (what to do)
- phase: string (e.g. "Phase 1: Setup")
- priority: "low" | "medium" | "high" | "critical"
- estimatedEffort: string (e.g. "2h", "30min")
- acceptanceCriteria: string

Generate 15-25 tasks. Return only the JSON array.`;

  try {
    const raw = await generateText(prompt);
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON found");

    const taskData = JSON.parse(jsonMatch[0]) as Array<{
      title: string;
      description?: string;
      phase?: string;
      priority?: string;
      estimatedEffort?: string;
      acceptanceCriteria?: string;
    }>;

    await db.insert(buildTasks).values(
      taskData.map((t) => ({
        projectId,
        title: t.title ?? "Untitled task",
        description: t.description,
        phase: t.phase,
        priority: (t.priority as "low" | "medium" | "high" | "critical") ?? "medium",
        estimatedEffort: t.estimatedEffort,
        acceptanceCriteria: t.acceptanceCriteria,
        status: "backlog" as const,
      }))
    );

    return NextResponse.json({ created: taskData.length });
  } catch (err) {
    return NextResponse.json({ error: "Failed to parse tasks" }, { status: 500 });
  }
}
