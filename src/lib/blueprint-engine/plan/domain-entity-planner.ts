import type { ProjectContext } from "@/lib/ai-prompts";
import type { ProjectBlueprint } from "@/lib/zod/blueprint-schemas";

type EntitySeed = ProjectBlueprint["entities"][string];

function entity(
  tableName: string,
  description: string,
  fields: EntitySeed["fields"] = []
): EntitySeed {
  return {
    id: `ENT-${tableName}`,
    tableName,
    description,
    fields,
    complete: fields.length > 0,
  };
}

function featureHaystack(ctx: Pick<
  ProjectContext,
  "shortDescription" | "longDescription" | "mainFeatures" | "adminFeatures" | "integrationNeeds"
>): string {
  return [
    ctx.shortDescription,
    ctx.longDescription,
    ctx.mainFeatures,
    ctx.adminFeatures,
    ctx.integrationNeeds,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function inferSalesCrmDomain(ctx: ProjectContext): boolean {
  // Bare "sales" is too common in ordinary product copy (e.g. a "retail sales" module
  // description) to signal a CRM/sales-pipeline domain on its own. Require it to appear
  // alongside a CRM-specific qualifier, or match one of the other CRM-specific terms directly.
  return /\bcrm\b|\bpipeline\b|\bleads?\b|\bsales[\s_-]?(?:rep(?:resentative)?s?|agents?|team|pipeline|funnel|lead(?:s)?)\b|sales.rep|sales_representative/i.test(
    featureHaystack(ctx)
  );
}

export function inferSocialMediaDomain(ctx: ProjectContext): boolean {
  return /\bsocial.media\b|\binstagram\b|\btiktok\b|\bcontent.calendar\b/i.test(
    featureHaystack(ctx)
  );
}

/** Domain tables inferred from wizard features — merged into canonical model, not a fixed core list. */
export function planDomainEntities(
  ctx: ProjectContext,
  classification: ProjectBlueprint["classification"]
): ProjectBlueprint["entities"] {
  const domain: ProjectBlueprint["entities"] = {};

  if (classification.multiTenant) {
    domain.organization_memberships = entity(
      "organization_memberships",
      "Tenant membership linking global user identity to an organization and tenant-scoped role",
      [
        { name: "organization_id", type: "uuid", constraints: "NOT NULL, FK organizations" },
        { name: "user_id", type: "uuid", constraints: "NOT NULL, FK users" },
        { name: "role", type: "text", constraints: "NOT NULL" },
        { name: "status", type: "text", constraints: "NOT NULL DEFAULT active" },
        { name: "invited_at", type: "timestamptz", constraints: "nullable" },
        { name: "joined_at", type: "timestamptz", constraints: "nullable" },
      ]
    );
  }

  if (inferSalesCrmDomain(ctx)) {
    domain.contacts = entity(
      "contacts",
      "People and accounts the sales agent manages within a tenant",
      [
        { name: "organization_id", type: "uuid", constraints: "NOT NULL, FK organizations" },
        { name: "full_name", type: "text", constraints: "NOT NULL" },
        { name: "email", type: "text", constraints: "nullable" },
        { name: "company", type: "text", constraints: "nullable" },
      ]
    );
    domain.leads = entity(
      "leads",
      "Qualified opportunities tracked by sales-facing agents",
      [
        { name: "organization_id", type: "uuid", constraints: "NOT NULL, FK organizations" },
        { name: "contact_id", type: "uuid", constraints: "nullable, FK contacts" },
        { name: "status", type: "text", constraints: "NOT NULL" },
        { name: "source", type: "text", constraints: "nullable" },
      ]
    );
    domain.follow_ups = entity(
      "follow_ups",
      "Scheduled sales follow-up tasks and reminders",
      [
        { name: "organization_id", type: "uuid", constraints: "NOT NULL, FK organizations" },
        { name: "lead_id", type: "uuid", constraints: "NOT NULL, FK leads" },
        { name: "due_at", type: "timestamptz", constraints: "NOT NULL" },
        { name: "status", type: "text", constraints: "NOT NULL" },
      ]
    );
    domain.interactions = entity(
      "interactions",
      "Logged sales touchpoints (calls, emails, meetings) tied to leads/contacts",
      [
        { name: "organization_id", type: "uuid", constraints: "NOT NULL, FK organizations" },
        { name: "lead_id", type: "uuid", constraints: "nullable, FK leads" },
        { name: "contact_id", type: "uuid", constraints: "nullable, FK contacts" },
        { name: "channel", type: "text", constraints: "NOT NULL" },
        { name: "occurred_at", type: "timestamptz", constraints: "NOT NULL" },
      ]
    );
  }

  if (inferSocialMediaDomain(ctx)) {
    domain.content_calendar = entity(
      "content_calendar",
      "Scheduled social posts and campaigns managed by social media agents",
      [
        { name: "organization_id", type: "uuid", constraints: "NOT NULL, FK organizations" },
        { name: "platform", type: "text", constraints: "NOT NULL" },
        { name: "scheduled_at", type: "timestamptz", constraints: "NOT NULL" },
        { name: "status", type: "text", constraints: "NOT NULL" },
      ]
    );
  }

  if (classification.hasAiAgents) {
    domain.workflow_run_events = entity(
      "workflow_run_events",
      "Append-only audit trail of workflow state transitions and execution events",
      [
        { name: "workflow_run_id", type: "uuid", constraints: "NOT NULL, FK workflow_runs" },
        { name: "event_type", type: "text", constraints: "NOT NULL" },
        { name: "from_state", type: "text", constraints: "nullable" },
        { name: "to_state", type: "text", constraints: "nullable" },
        { name: "payload", type: "jsonb", constraints: "nullable" },
        { name: "occurred_at", type: "timestamptz", constraints: "NOT NULL DEFAULT now()" },
      ]
    );
  }

  return domain;
}

export function mergeDomainEntities(
  blueprint: ProjectBlueprint,
  ctx: ProjectContext
): ProjectBlueprint {
  const planned = planDomainEntities(ctx, blueprint.classification);
  const entities = { ...blueprint.entities };

  for (const [key, definition] of Object.entries(planned)) {
    if (!entities[key]) {
      entities[key] = definition;
      continue;
    }
    if (entities[key].fields.length === 0 && definition.fields.length > 0) {
      entities[key] = {
        ...entities[key],
        fields: definition.fields,
        complete: definition.complete,
        description: entities[key].description ?? definition.description,
      };
    }
  }

  if (entities.users && classificationUsesGlobalIdentity(blueprint)) {
    entities.users = {
      ...entities.users,
      description:
        "Global human identity (auth provider subject). Tenant access is via organization_memberships — do not embed tenant role on users alone.",
    };
  }

  return { ...blueprint, entities };
}

function classificationUsesGlobalIdentity(blueprint: ProjectBlueprint): boolean {
  return blueprint.classification.multiTenant && Boolean(blueprint.entities.users);
}

export function domainEntityNames(ctx: ProjectContext, classification: ProjectBlueprint["classification"]): string[] {
  return Object.keys(planDomainEntities(ctx, classification));
}
