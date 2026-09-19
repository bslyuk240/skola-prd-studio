import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { oauthTokens, oauthClients } from "@/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: oauthTokens.id,
      clientName: oauthClients.clientName,
      createdAt: oauthTokens.createdAt,
      lastUsedAt: oauthTokens.lastUsedAt,
    })
    .from(oauthTokens)
    .innerJoin(oauthClients, eq(oauthTokens.clientId, oauthClients.id))
    .where(and(eq(oauthTokens.userId, userId), isNull(oauthTokens.revokedAt)))
    .orderBy(desc(oauthTokens.createdAt));

  return NextResponse.json({ connections: rows });
}
