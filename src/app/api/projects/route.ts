import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, documents } from "@/db/schema";
import { z } from "zod";
import { buildBlueprintFromWizard } from "@/lib/blueprint-engine/extract/extract-blueprint-model";
import type { ProjectContext } from "@/lib/ai-prompts";
import { PROJECT_DOCUMENT_DEFINITIONS } from "@/lib/project-document-types";

const schema = z.object({
  appName: z.string().min(1),
  shortDescription: z.string().min(1),
  longDescription: z.string().optional(),
  appCategory: z.string().optional(),
  targetUsers: z.string().optional(),
  problemSolved: z.string().optional(),
  mainGoal: z.string().optional(),
  platformType: z.string().optional(),
  frontendFramework: z.string().optional(),
  backendFramework: z.string().optional(),
  database: z.string().optional(),
  authProvider: z.string().optional(),
  hostingProvider: z.string().optional(),
  fileStorage: z.string().optional(),
  paymentProvider: z.string().optional(),
  userRoles: z.string().optional(),
  mainFeatures: z.string().optional(),
  adminFeatures: z.string().optional(),
  monetisationModel: z.string().optional(),
  notificationNeeds: z.string().optional(),
  integrationNeeds: z.string().optional(),
  multiTenancy: z.boolean().optional(),
  fileUpload: z.boolean().optional(),
  securityLevel: z.enum(["basic", "standard", "high", "enterprise"]).optional(),
  securityToggles: z.record(z.string(), z.boolean()).optional(),
});

const DOC_TYPES = PROJECT_DOCUMENT_DEFINITIONS;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const data = parsed.data;
  const blueprintSeed = buildBlueprintFromWizard(data as ProjectContext);

  const [project] = await db
    .insert(projects)
    .values({
      userId,
      name: data.appName,
      description: data.shortDescription,
      appType: data.appCategory,
      platform: data.platformType,
      securityLevel: data.securityLevel ?? "standard",
      status: "draft",
      readinessScore: 0,
      securityScore: 0,
      stackPreferences: {
        frontend: data.frontendFramework,
        backend: data.backendFramework,
        database: data.database,
        auth: data.authProvider,
        hosting: data.hostingProvider,
        storage: data.fileStorage,
        payment: data.paymentProvider,
      },
      wizardData: data,
      blueprintModel: blueprintSeed,
    })
    .returning();

  // Create placeholder document records
  await db.insert(documents).values(
    DOC_TYPES.map(({ type, title }) => ({
      projectId: project.id,
      type,
      title,
      status: "pending" as const,
    }))
  );

  return NextResponse.json({ projectId: project.id });
}
