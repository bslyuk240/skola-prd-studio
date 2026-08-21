import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects, documents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getProjectBlueprint } from "@/lib/blueprint-engine/project-blueprint-service";
import {
  isBlueprintModelApproved,
  wizardStackFromBlueprint,
} from "@/lib/blueprint-engine/apply-architecture-resolution";
import { ArchitectureResolutionClient } from "@/components/documents/architecture-resolution-client";

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function ArchitectureResolutionPage({ params }: Props) {
  const { projectId } = await params;
  const { userId } = await auth();
  if (!userId) return null;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!project) notFound();

  const docs = await db.select().from(documents).where(eq(documents.projectId, projectId));

  const blueprint = await getProjectBlueprint(project);
  if (!blueprint) notFound();

  if (isBlueprintModelApproved(blueprint, docs)) {
    redirect(`/projects/${projectId}/documents`);
  }

  return (
    <ArchitectureResolutionClient
      projectId={project.id}
      projectName={project.name}
      blueprint={blueprint}
      stackFields={wizardStackFromBlueprint(blueprint)}
      approved={false}
    />
  );
}
