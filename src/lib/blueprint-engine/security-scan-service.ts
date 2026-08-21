import { db } from "@/db";
import { documents, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  projectBlueprintSchema,
  securityScanModelSchema,
  type ProjectBlueprint,
  type SecurityScanModel,
} from "@/lib/zod/blueprint-schemas";
import { getProjectBlueprint } from "@/lib/blueprint-engine/project-blueprint-service";
import {
  buildSecurityFixValidationReport,
  type SecurityFixValidationReport,
} from "@/lib/blueprint-engine/validate/security-fix-validation";

export async function getLinkedProjectBlueprintForScan(
  projectId: string | null | undefined,
  userId: string
): Promise<ProjectBlueprint | null> {
  if (!projectId) return null;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!project) return null;
  return getProjectBlueprint(project);
}

export async function getProjectSecurityBlueprintContent(
  projectId: string
): Promise<string | null> {
  const [doc] = await db
    .select({ content: documents.content })
    .from(documents)
    .where(and(eq(documents.projectId, projectId), eq(documents.type, "security_blueprint")))
    .limit(1);

  return doc?.content ?? null;
}

export function parseSecurityScanModel(value: unknown): SecurityScanModel | null {
  const parsed = securityScanModelSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function validateSecurityFixPrd(
  scanModel: SecurityScanModel,
  prdContent: string,
  linkedBlueprint: ProjectBlueprint | null,
  securityBlueprintContent: string | null
): SecurityFixValidationReport {
  return buildSecurityFixValidationReport(
    scanModel,
    prdContent,
    linkedBlueprint,
    securityBlueprintContent
  );
}

export async function validateSecurityFixPrdForProject(
  scanModel: SecurityScanModel,
  prdContent: string,
  userId: string
): Promise<SecurityFixValidationReport> {
  const linkedBlueprint = await getLinkedProjectBlueprintForScan(
    scanModel.linkedProjectId,
    userId
  );
  const securityBlueprintContent = scanModel.linkedProjectId
    ? await getProjectSecurityBlueprintContent(scanModel.linkedProjectId)
    : null;

  return validateSecurityFixPrd(
    scanModel,
    prdContent,
    linkedBlueprint,
    securityBlueprintContent
  );
}

export function parseLinkedProjectBlueprint(value: unknown): ProjectBlueprint | null {
  const parsed = projectBlueprintSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
