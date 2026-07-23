import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const schema = z.object({
  aiModel: z.string().optional(),
  defaultSecurityLevel: z.enum(["basic", "standard", "high", "enterprise"]).optional(),
  defaultSecurityToggles: z.record(z.string(), z.boolean()).optional(),
  wordCountVisible: z.boolean().optional(),
  autoRefresh: z.boolean().optional(),
  creditLimit: z.number().int().min(0).max(1000000).optional(),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [prefs] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  return NextResponse.json(prefs ?? null);
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  await db
    .insert(userPreferences)
    .values({ userId, ...parsed.data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { ...parsed.data, updatedAt: new Date() },
    });

  return NextResponse.json({ success: true });
}
