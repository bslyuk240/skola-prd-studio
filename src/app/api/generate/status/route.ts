import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, documents } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  const documentType = req.nextUrl.searchParams.get("documentType");
  if (!projectId || !documentType) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.projectId, projectId), eq(documents.type, documentType as typeof documents.$inferSelect["type"])))
    .limit(1);

  return NextResponse.json({
    status: doc?.status ?? "pending",
    wordCount: doc?.wordCount ?? 0,
  });
}
