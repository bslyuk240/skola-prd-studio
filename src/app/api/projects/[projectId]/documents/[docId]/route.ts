import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, documents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const schema = z.object({
  status: z.enum(["pending", "generating", "ready", "approved", "needs_revision"]).optional(),
  content: z.string().optional(),
});

interface Params {
  params: Promise<{ projectId: string; docId: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { projectId, docId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  await db
    .update(documents)
    .set({ ...parsed.data, updatedAt: new Date(), ...(parsed.data.status === "approved" ? { approvedAt: new Date() } : {}) })
    .where(and(eq(documents.id, docId), eq(documents.projectId, projectId)));

  return NextResponse.json({ success: true });
}
