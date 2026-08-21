import type { ProjectBlueprint } from "@/lib/zod/blueprint-schemas";
import type { glossaryEntrySchema } from "@/lib/zod/blueprint-schemas";
import type { z } from "zod";

type GlossaryEntry = z.infer<typeof glossaryEntrySchema>;

/** Known synonym drift patterns for common blueprint entities. */
const KNOWN_ENTITY_SYNONYMS: Record<string, string[]> = {
  approval_requests: [
    "approval_tasks",
    "agent_actions",
    "approvals",
    "confirmation_tasks",
    "approval_task",
  ],
  workflow_runs: ["agent_runs", "job_runs", "execution_jobs", "workflow_run", "agent_run"],
  tool_executions: ["tool_calls", "agent_actions", "action_logs", "tool_call"],
  agent_versions: ["agent_configs", "agent_snapshots", "agent_config", "version_snapshots"],
  agents: ["ai_agents", "bot_agents", "assistant_agents"],
  users: ["user_accounts", "accounts"],
  organizations: ["tenants", "orgs", "workspaces", "tenant_orgs"],
};

function singularizeSnake(name: string): string | null {
  if (!name.endsWith("s") || name.length < 4) return null;
  const singular = name.slice(0, -1);
  return singular.includes("_") ? singular : null;
}

function pluralizeSnake(name: string): string | null {
  if (name.endsWith("s")) return null;
  return `${name}s`;
}

function deriveSynonymsForEntity(tableName: string): string[] {
  const known = KNOWN_ENTITY_SYNONYMS[tableName] ?? [];
  const derived = new Set<string>(known);

  const singular = singularizeSnake(tableName);
  if (singular && singular !== tableName) derived.add(singular);

  const plural = pluralizeSnake(tableName);
  if (plural && plural !== tableName) derived.add(plural);

  const withoutUnderscores = tableName.replace(/_/g, "");
  if (withoutUnderscores !== tableName && withoutUnderscores.length > 3) {
    derived.add(withoutUnderscores);
  }

  derived.delete(tableName);
  return [...derived];
}

function mergeGlossaryEntries(existing: GlossaryEntry[], incoming: GlossaryEntry[]): GlossaryEntry[] {
  const byCanonical = new Map<string, GlossaryEntry>();

  for (const entry of existing) {
    byCanonical.set(entry.canonical, { ...entry });
  }

  for (const entry of incoming) {
    const prev = byCanonical.get(entry.canonical);
    if (!prev) {
      byCanonical.set(entry.canonical, entry);
      continue;
    }

    const rejectedSynonyms = [
      ...new Set([...prev.rejectedSynonyms, ...entry.rejectedSynonyms]),
    ].filter((s) => s !== entry.canonical);

    byCanonical.set(entry.canonical, {
      canonical: entry.canonical,
      definition: entry.definition || prev.definition,
      rejectedSynonyms,
    });
  }

  return [...byCanonical.values()].sort((a, b) => a.canonical.localeCompare(b.canonical));
}

/** Build glossary entries from entities, roles, and known synonym maps. */
export function buildGlossaryFromBlueprint(blueprint: Pick<ProjectBlueprint, "entities" | "roles" | "glossary">): GlossaryEntry[] {
  const fromEntities: GlossaryEntry[] = Object.values(blueprint.entities).map((entity) => ({
    canonical: entity.tableName,
    definition: entity.description ?? `Database entity ${entity.tableName}`,
    rejectedSynonyms: deriveSynonymsForEntity(entity.tableName),
  }));

  const fromRoles: GlossaryEntry[] = Object.entries(blueprint.roles).map(([roleKey, role]) => ({
    canonical: roleKey,
    definition: role.description ?? `Application role ${roleKey}`,
    rejectedSynonyms: [],
  }));

  return mergeGlossaryEntries(blueprint.glossary, [...fromEntities, ...fromRoles]);
}

/** Merge derived glossary into blueprint (does not mutate input). */
export function applyGlossaryToBlueprint(blueprint: ProjectBlueprint): ProjectBlueprint {
  return {
    ...blueprint,
    glossary: buildGlossaryFromBlueprint(blueprint),
  };
}

export { KNOWN_ENTITY_SYNONYMS, mergeGlossaryEntries };
