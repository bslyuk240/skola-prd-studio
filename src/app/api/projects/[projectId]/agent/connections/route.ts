import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, agentConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateAgentToken } from "@/lib/agent-tokens";
import { z } from "zod";

const schema = z.object({
  connectionName: z.string().min(3).max(50),
  agentType: z.enum(["cursor", "windsurf", "claude_code", "copilot", "replit", "other"]),
});

async function getOwnedProject(projectId: string, userId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  return project;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const project = await getOwnedProject(projectId, userId);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const connections = await db
    .select({
      id: agentConnections.id,
      agentType: agentConnections.agentType,
      connectionName: agentConnections.connectionName,
      status: agentConnections.status,
      scopes: agentConnections.scopes,
      createdAt: agentConnections.createdAt,
      revokedAt: agentConnections.revokedAt,
    })
    .from(agentConnections)
    .where(eq(agentConnections.projectId, projectId));

  return NextResponse.json({ connections });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const project = await getOwnedProject(projectId, userId);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });

  const { connectionName, agentType } = parsed.data;
  const { plainTextToken, tokenHash } = generateAgentToken();

  const [connection] = await db
    .insert(agentConnections)
    .values({
      projectId,
      agentType,
      connectionName,
      tokenHash,
      scopes: ["read:context", "write:progress"],
    })
    .returning();

  const mcpUrl = `${process.env.URL ?? process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin}/api/mcp/v1`;

  return NextResponse.json(
    {
      id: connection.id,
      connectionName: connection.connectionName,
      plainTextToken,
      mcpConfigSample: {
        mcpServers: {
          "prd-studio-connector": {
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
