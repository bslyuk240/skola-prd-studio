import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { personalApiKeys } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ keyId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { keyId } = await params;

  await db
    .update(personalApiKeys)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(and(eq(personalApiKeys.id, keyId), eq(personalApiKeys.userId, userId)));

  return NextResponse.json({ success: true });
}
