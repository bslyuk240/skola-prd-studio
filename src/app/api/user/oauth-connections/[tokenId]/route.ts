import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { oauthTokens } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tokenId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tokenId } = await params;

  await db
    .update(oauthTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(oauthTokens.id, tokenId), eq(oauthTokens.userId, userId)));

  return NextResponse.json({ success: true });
}
