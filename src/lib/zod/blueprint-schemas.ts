import { z } from "zod";

export const assumptionKindSchema = z.enum([
  "user_requirement",
  "engineering_requirement",
  "assumption",
  "target",
  "recommendation",
]);

export const validationSeveritySchema = z.enum([
  "error",
  "warning",
  "assumption",
  "recommendation",
]);

export const productStageSchema = z.enum([
  "prototype",
  "mvp",
  "production",
  "enterprise",
]);

export const securityRequirementLevelSchema = z.enum([
  "standard",
  "high",
  "enterprise",
  "regulated",
]);

export const scopeTimingSchema = z.enum([
  "required_now",
  "architectural_preparation",
  "future",
]);

export const modelProfileSchema = z.enum([
  "FAST",
  "BALANCED",
  "REASONING",
  "VISION",
  "EMBEDDING",
]);

export const toolRiskLevelSchema = z.enum([
  "READ",
  "INTERNAL_WRITE",
  "EXTERNAL_COMMUNICATION",
  "PUBLIC_WRITE",
  "FINANCIAL_WRITE",
]);

export const entityDefinitionSchema = z.object({
  id: z.string().min(1),
  tableName: z.string().min(1),
  description: z.string().optional(),
  fields: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
        constraints: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .default([]),
  complete: z.boolean().default(false),
});

export const glossaryEntrySchema = z.object({
  canonical: z.string().min(1),
  definition: z.string().min(1),
  rejectedSynonyms: z.array(z.string()).default([]),
});

export const assumptionEntrySchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  kind: assumptionKindSchema,
  requiresValidation: z.boolean().default(false),
  source: z.enum(["user", "generated"]).default("generated"),
});

export const integrationFailurePolicySchema = z.object({
  timeoutMs: z.number().int().positive().default(30000),
  maxRetries: z.number().int().min(0).default(3),
  retryBackoff: z.enum(["exponential", "linear", "none"]).default("exponential"),
  idempotencyKeyRequired: z.boolean().default(false),
});

export const apiEndpointSchema = z.object({
  id: z.string().min(1),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string().min(1),
  purpose: z.string().min(1),
  actor: z.string().optional(),
  authRequired: z.boolean().default(true),
  idempotent: z.boolean().default(false),
  featureKey: z.string().optional(),
  accessPattern: z.enum(["read", "write", "read_write"]).optional(),
  delivery: z.enum(["sync", "async", "webhook"]).default("sync"),
  linkedIntegrationId: z.string().optional(),
});

export const integrationDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  purpose: z.string().min(1),
  protocol: z.string().default("HTTPS"),
  authentication: z.string().optional(),
  direction: z.enum(["inbound", "outbound", "bidirectional"]).default("outbound"),
  webhooks: z.boolean().default(false),
  retryPolicy: z.boolean().default(false),
  verified: z.boolean().default(false),
  failurePolicy: integrationFailurePolicySchema.optional(),
});

export const webhookDefinitionSchema = z.object({
  id: z.string().min(1),
  provider: z.string().min(1),
  event: z.string().min(1),
  endpoint: z.string().min(1),
  signatureVerification: z.boolean().default(true),
});

export const stateMachineSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  states: z.array(z.string().min(1)).min(2),
  transitions: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      trigger: z.string().optional(),
    })
  ),
  terminalStates: z.array(z.string()).default([]),
});

export const permissionMatrixSchema = z.record(
  z.string(),
  z.array(z.string())
);

export const aiToolPolicySchema = z.object({
  toolName: z.string().min(1),
  risk: toolRiskLevelSchema,
  approvalRequired: z.boolean().default(false),
  idempotencyRequired: z.boolean().default(false),
});

export const aiActionPolicySchema = z.object({
  authorizationChain: z.array(z.string().min(1)).min(1),
  schemaValidationIsNotAuthorization: z.boolean().default(true),
});

export const testCaseSchema = z.object({
  id: z.string().min(1),
  requirementId: z.string().optional(),
  type: z.enum(["unit", "integration", "e2e", "security", "performance", "accessibility"]),
  priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  description: z.string().min(1),
  automationCandidate: z.boolean().default(true),
  failureScenario: z.string().optional(),
  integrationId: z.string().optional(),
});

export const environmentModelSchema = z.object({
  name: z.string().min(1),
  purpose: z.string().min(1),
  dataPolicy: z.enum(["synthetic", "masked", "production_like"]).default("synthetic"),
});

export const backupRecoveryModelSchema = z.object({
  component: z.string().min(1),
  strategy: z.string().min(1),
  rpoMinutes: z.number().int().positive().optional(),
  rtoMinutes: z.number().int().positive().optional(),
});

export const validationIssueSchema = z.object({
  id: z.string().min(1),
  severity: validationSeveritySchema,
  category: z.string().min(1),
  message: z.string().min(1),
  resolution: z.string().optional(),
  documentTypes: z.array(z.string()).default([]),
});

export const projectBlueprintSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string().datetime(),
  product: z.object({
    name: z.string().min(1),
    type: z.string().optional(),
    stage: productStageSchema.default("mvp"),
    securityRequirement: securityRequirementLevelSchema.default("standard"),
  }),
  classification: z.object({
    projectType: z.string().optional(),
    multiTenant: z.boolean().default(false),
    hasFileUpload: z.boolean().default(false),
    hasAiAgents: z.boolean().default(false),
    hasAsyncProcessing: z.boolean().default(false),
    hasRealtime: z.boolean().default(false),
  }),
  stack: z.object({
    frontend: z.string().optional(),
    backend: z.string().optional(),
    hosting: z.string().optional(),
    database: z.string().optional(),
    orm: z.string().optional(),
    auth: z.string().optional(),
    storage: z.string().optional(),
    payment: z.string().optional(),
    aiGateway: z.string().optional(),
    workflowEngine: z.string().optional(),
    locked: z.boolean().default(true),
  }),
  embedding: z
    .object({
      provider: z.string().optional(),
      modelProfile: modelProfileSchema.default("EMBEDDING"),
      dimensions: z.number().int().positive().optional(),
      distanceFunction: z.string().optional(),
    })
    .optional(),
  entities: z.record(z.string(), entityDefinitionSchema).default({}),
  glossary: z.array(glossaryEntrySchema).default([]),
  roles: z.record(z.string(), z.object({ description: z.string().optional() })).default({}),
  permissions: permissionMatrixSchema.default({}),
  workflows: z.record(z.string(), z.object({ description: z.string().optional() })).default({}),
  stateMachines: z.array(stateMachineSchema).default([]),
  apis: z.array(apiEndpointSchema).default([]),
  integrations: z.array(integrationDefinitionSchema).default([]),
  webhooks: z.array(webhookDefinitionSchema).default([]),
  aiTools: z.array(aiToolPolicySchema).default([]),
  aiActionPolicy: aiActionPolicySchema.optional(),
  requirements: z.object({
    functional: z.array(
      z.object({
        id: z.string(),
        statement: z.string(),
        priority: z.enum(["must_have", "should_have", "could_have"]).default("must_have"),
        scope: scopeTimingSchema.default("required_now"),
      })
    ).default([]),
    nonFunctional: z.array(z.string()).default([]),
  }),
  testing: z.object({
    testCases: z.array(testCaseSchema).default([]),
  }),
  deployment: z.object({
    environments: z.array(z.string()).default(["development", "production"]),
    provider: z.string().optional(),
    ciSteps: z.array(z.string()).default([]),
    environmentModel: z.array(environmentModelSchema).optional(),
    ciPipeline: z
      .object({
        trigger: z.string(),
        stages: z.array(z.string()),
      })
      .optional(),
    backupRecovery: z.array(backupRecoveryModelSchema).optional(),
  }),
  assumptions: z.array(assumptionEntrySchema).default([]),
  uploadPolicy: z
    .object({
      allowedTypes: z.array(z.string()).default([]),
    })
    .optional(),
  metadata: z.object({
    projectStartDate: z.string().nullable().default(null),
    generationDate: z.string(),
    modelApprovedAt: z.string().datetime().nullable().default(null),
  }),
});

export type ProjectBlueprint = z.infer<typeof projectBlueprintSchema>;
export type ValidationIssue = z.infer<typeof validationIssueSchema>;
export type AssumptionKind = z.infer<typeof assumptionKindSchema>;
export type ModelProfile = z.infer<typeof modelProfileSchema>;

export const featureScopeSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  affectedRoles: z.string().optional(),
  affectsPermissions: z.boolean().default(false),
  needsNewTables: z.boolean().default(false),
  needsNotifications: z.boolean().default(false),
  affectsDashboard: z.boolean().default(false),
  mobileRequired: z.boolean().default(false),
  affectsBilling: z.boolean().default(false),
  scopeLevel: z.enum(["mvp", "full"]).default("mvp"),
  additionalContext: z.string().optional(),
});

export const featureBlueprintSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string().datetime(),
  linkedProjectId: z.string().uuid().nullable().default(null),
  feature: featureScopeSchema,
  /** Existing project entities touched by this feature (entity id → definition copy) */
  linkedEntities: z.record(z.string(), entityDefinitionSchema).default({}),
  /** New or modified entities introduced by this feature */
  impactedEntities: z.record(z.string(), entityDefinitionSchema).default({}),
  deltaApis: z.array(apiEndpointSchema).default([]),
  requirements: z.object({
    functional: z
      .array(
        z.object({
          id: z.string(),
          statement: z.string(),
          priority: z.enum(["must_have", "should_have", "could_have"]).default("must_have"),
        })
      )
      .default([]),
  }),
  testing: z.object({
    testCases: z.array(testCaseSchema).default([]),
  }),
  deployment: z.object({
    environments: z.array(z.string()).default(["development", "production"]),
    ciSteps: z.array(z.string()).default([]),
    ciPipeline: z
      .object({
        trigger: z.string(),
        stages: z.array(z.string()),
      })
      .optional(),
    rollbackSteps: z.array(z.string()).default([]),
  }),
  glossary: z.array(glossaryEntrySchema).default([]),
});

export type FeatureBlueprint = z.infer<typeof featureBlueprintSchema>;
export type FeatureScope = z.infer<typeof featureScopeSchema>;

export const securityRemediationRequirementSchema = z.object({
  id: z.string().min(1),
  findingTitle: z.string().min(1),
  pack: z.string().min(1),
  confidence: z.enum(["confirmed", "likely_gap", "needs_review", "recommended"]),
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
  statement: z.string().min(1),
  recommendation: z.string().min(1),
});

export const securityScanModelSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string().datetime(),
  linkedProjectId: z.string().uuid().nullable().default(null),
  safeToShipScore: z.number().int().min(0).max(100),
  scoreTarget: z.object({
    id: z.literal("TARGET-SAFE-TO-SHIP"),
    statement: z.string().min(1),
    kind: z.literal("target"),
    requiresValidation: z.literal(true),
    value: z.number().int().min(0).max(100),
  }),
  remediationRequirements: z.array(securityRemediationRequirementSchema).default([]),
});

export type SecurityScanModel = z.infer<typeof securityScanModelSchema>;
export type SecurityRemediationRequirement = z.infer<typeof securityRemediationRequirementSchema>;
