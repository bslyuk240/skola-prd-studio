import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createProjectFromInput } from "@/lib/mcp-studio/create-project";
import { createProjectParams } from "@/lib/validators/mcp-studio";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createProjectParams.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const project = await createProjectFromInput(userId, parsed.data);

  return NextResponse.json({ projectId: project.id });
}
