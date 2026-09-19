import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { personalApiKeys } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { generatePersonalApiKey } from "@/lib/personal-api-keys";

const schema = z.object({
  name: z.string().min(1).max(60),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keys = await db
    .select({
      id: personalApiKeys.id,
      name: personalApiKeys.name,
      status: personalApiKeys.status,
      lastUsedAt: personalApiKeys.lastUsedAt,
      createdAt: personalApiKeys.createdAt,
      revokedAt: personalApiKeys.revokedAt,
    })
    .from(personalApiKeys)
    .where(eq(personalApiKeys.userId, userId))
    .orderBy(desc(personalApiKeys.createdAt));

  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });

  const { plainTextToken, tokenHash } = generatePersonalApiKey();

  const [key] = await db
    .insert(personalApiKeys)
    .values({ userId, name: parsed.data.name, tokenHash })
    .returning();

  const mcpUrl = `${process.env.URL ?? process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin}/api/mcp/studio/v1`;

  return NextResponse.json(
    {
      id: key.id,
      name: key.name,
      plainTextToken,
      mcpConfigSample: {
        mcpServers: {
          "prd-studio": {
            type: "http",
            url: mcpUrl,
            headers: { Authorization: `Bearer ${plainTextToken}` },
          },
        },
      },
    },
    { status: 201 }
  );
}
