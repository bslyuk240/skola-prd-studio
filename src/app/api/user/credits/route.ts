import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUserCreditStatus } from "@/lib/credits";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const status = await getUserCreditStatus(userId);
    return NextResponse.json(status);
  } catch {
    return NextResponse.json({ error: "Failed to fetch credit status" }, { status: 500 });
  }
}
