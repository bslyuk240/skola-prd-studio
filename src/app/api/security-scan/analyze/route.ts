import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runSecurityScan } from "@/lib/security-scan-runner";

export const maxDuration = 60;

const schema = z.object({
  provider: z.enum(["github", "manual"]).default("github"),
  repoUrl: z.string().optional(),
  branch: z.string().optional(),
  accessToken: z.string().optional(),
  manualContext: z.string().optional(),
  projectId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const outcome = await runSecurityScan({ userId, ...parsed.data });
  if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });

  return NextResponse.json(outcome.result);
}
