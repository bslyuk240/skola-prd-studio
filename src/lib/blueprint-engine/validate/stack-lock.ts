import type { ProjectBlueprint } from "@/lib/zod/blueprint-schemas";
import { resolveServiceKey } from "@/lib/blueprint-engine/registry/capabilities";

const HOSTING_CONFLICTS: Record<string, string> = {
  vercel: "netlify",
  netlify: "vercel",
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Remove integrations and references that conflict with locked hosting. */
export function applyStackLock(blueprint: ProjectBlueprint): ProjectBlueprint {
  if (!blueprint.stack.locked) return blueprint;

  const hostingKey = resolveServiceKey(blueprint.stack.hosting);
  const conflictingKey = hostingKey ? HOSTING_CONFLICTS[hostingKey] : undefined;
  if (!conflictingKey) return blueprint;

  const integrations = blueprint.integrations.filter(
    (integration) => resolveServiceKey(integration.name) !== conflictingKey
  );

  const lockedProvider =
    hostingKey === "vercel"
      ? "Vercel"
      : hostingKey === "netlify"
        ? "Netlify"
        : blueprint.stack.hosting;

  return {
    ...blueprint,
    integrations,
    deployment: {
      ...blueprint.deployment,
      provider: lockedProvider ?? blueprint.deployment.provider,
    },
  };
}

/** Strip or replace conflicting provider names in generated document text. */
export function enforceStackLockInText(
  text: string,
  blueprint: ProjectBlueprint
): string {
  if (!blueprint.stack.locked) return text;

  const hostingKey = resolveServiceKey(blueprint.stack.hosting);
  const conflictingKey = hostingKey ? HOSTING_CONFLICTS[hostingKey] : undefined;
  if (!conflictingKey || !blueprint.stack.hosting) return text;

  const lockedName = blueprint.stack.hosting;
  const conflictNames =
    conflictingKey === "netlify"
      ? ["Netlify", "netlify", "NETLIFY"]
      : ["Vercel", "vercel", "VERCEL"];

  let output = text;
  for (const conflict of conflictNames) {
    const pattern = new RegExp(`\\b${escapeRegExp(conflict)}\\b`, "g");
    output = output.replace(pattern, lockedName);
  }
  return output;
}

export function getLockedStackProviders(blueprint: ProjectBlueprint): string[] {
  const providers = new Set<string>();
  for (const value of Object.values(blueprint.stack)) {
    if (typeof value === "string" && value.trim()) {
      providers.add(value.trim());
    }
  }
  return [...providers];
}
