export { buildBlueprintSeedFromWizard, validateBlueprintSeed, summarizeStackVerification } from "@/lib/blueprint-engine/extract/from-wizard-context";
export {
  extractBlueprintModel,
  buildBlueprintFromWizard,
} from "@/lib/blueprint-engine/extract/extract-blueprint-model";
export { mergeBlueprint, extractJsonObject } from "@/lib/blueprint-engine/extract/merge-blueprint";
export {
  ensureProjectBlueprint,
  ensureProjectBlueprintById,
  getProjectBlueprint,
  saveProjectBlueprint,
} from "@/lib/blueprint-engine/project-blueprint-service";
export { SERVICE_CAPABILITY_REGISTRY, getServiceCapability, detectStackConflicts } from "@/lib/blueprint-engine/registry/capabilities";
export { MODEL_PROFILE_REGISTRY, resolveModelForProfile } from "@/lib/blueprint-engine/registry/model-profiles";
export { lintTerminology, buildGlossaryPromptBlock } from "@/lib/blueprint-engine/validate/terminology-lint";
export {
  enforceTerminologyOnContent,
  applySynonymReplacements,
  collectTerminologyIssues,
} from "@/lib/blueprint-engine/validate/enforce-terminology";
export {
  buildGlossaryFromBlueprint,
  applyGlossaryToBlueprint,
} from "@/lib/blueprint-engine/registry/glossary-builder";
export { validateStructuralCompleteness } from "@/lib/blueprint-engine/validate/structural-completeness";
export {
  extractFencedCodeBlocks,
  validateCodeSnippet,
  validateMermaid,
  validateSql,
  validateJson,
  validateTypeScript,
  stripInvalidCodeSnippets,
  sanitizeDocumentsCodeSnippets,
  codeSnippetIssuesFromContent,
} from "@/lib/blueprint-engine/validate/code-snippet-qa";
export { runBlueprintValidation } from "@/lib/blueprint-engine/validate/readiness";
export {
  computeReadinessBreakdown,
  type ReadinessBreakdown,
} from "@/lib/blueprint-engine/validate/compute-readiness-breakdown";
export {
  countSecurityTodosFromWizard,
  mergeSecurityTodoCounts,
} from "@/lib/blueprint-engine/security-todo-scoring";
export {
  extractClaimsFromDocument,
  extractUploadTypes,
  extractEndpoints,
} from "@/lib/blueprint-engine/validate/extract-claims";
export {
  validateDocumentConsistency,
  validateCrossDocumentConsistency,
  hasBlockingConsistencyErrors,
  consistencyErrorsForDocument,
} from "@/lib/blueprint-engine/validate/consistency-validator";
export {
  validateStateMachineStructure,
  validateStateTransitionsInDocument,
  validateWorkflowDocuments,
  extractDocumentTransitions,
  workflowErrorsForDocument,
} from "@/lib/blueprint-engine/validate/state-machine-validator";
export {
  planAiToolPolicies,
  validateAiToolPolicies,
  validateAiActionPolicy,
  validateAiPolicyInDocument,
  aiPolicyErrorsForDocument,
  DEFAULT_AUTHORIZATION_CHAIN,
} from "@/lib/blueprint-engine/validate/ai-action-policy";
export { serializeBlueprintForPrompt } from "@/lib/blueprint-engine/render/prompt-context";
export {
  renderDocument,
  getSectionsForDocument,
  isBlueprintDocumentType,
  BLUEPRINT_DOCUMENT_TYPES,
} from "@/lib/blueprint-engine/render/render-document";
export type { BlueprintDocumentType } from "@/lib/blueprint-engine/render/document-sections";
export { DOCUMENT_SECTIONS } from "@/lib/blueprint-engine/render/document-sections";
export {
  buildModelBindingBlock,
  buildGanttTimelineRules,
  buildImplementationPhaseOrderRules,
} from "@/lib/blueprint-engine/render/model-binding";
export {
  serializeApiCatalogueForPrompt,
  getSharedApiCatalogue,
} from "@/lib/blueprint-engine/render/api-catalogue";
export { classifyFeaturesFromContext, classifyFeatureApiNeed } from "@/lib/blueprint-engine/plan/feature-api-classifier";
export { planIntegrationLayer, applyIntegrationPlan } from "@/lib/blueprint-engine/plan/integration-planner";
export { finalizeBlueprint } from "@/lib/blueprint-engine/plan/finalize-blueprint";
export { applyQaAndOpsPlan } from "@/lib/blueprint-engine/plan/qa-ops-planner";
export { planFunctionalRequirements } from "@/lib/blueprint-engine/plan/requirements-planner";
export {
  planQaTestCases,
  everyRequirementHasTestCase,
  requirementsMissingTests,
  inferProjectTypeProfile,
} from "@/lib/blueprint-engine/plan/qa-planner";
export {
  planOperationsModel,
  environmentsForStage,
  ciStepsForBlueprint,
} from "@/lib/blueprint-engine/plan/operations-planner";
export { serializeQaOpsForPrompt } from "@/lib/blueprint-engine/render/qa-ops-catalogue";
export {
  applyStackLock,
  enforceStackLockInText,
  getLockedStackProviders,
} from "@/lib/blueprint-engine/validate/stack-lock";
export {
  patchBlueprintFromIssues,
  affectedDocumentTypes,
  isResolvableIssue,
} from "@/lib/blueprint-engine/critic/conflict-resolver";
export type { BlueprintPatch } from "@/lib/blueprint-engine/critic/conflict-resolver";
export {
  runArchitectCritic,
  MAX_CRITIC_ITERATIONS,
} from "@/lib/blueprint-engine/critic/critic-orchestrator";
export {
  buildIntegrityReport,
  resolveIntegrityStatus,
  issueAcceptable,
  INTEGRITY_CATEGORIES,
  formatIssueCategory,
} from "@/lib/blueprint-engine/integrity-report";
export type { IntegrityReport, IntegrityStatus } from "@/lib/blueprint-engine/integrity-report";
export {
  applyArchitectureResolution,
  approveBlueprintModel,
  isBlueprintModelApproved,
  wizardStackFromBlueprint,
  stackPreferencesFromBlueprint,
} from "@/lib/blueprint-engine/apply-architecture-resolution";
export type { ArchitectureResolutionUpdates } from "@/lib/blueprint-engine/apply-architecture-resolution";
export {
  buildFeatureBlueprint,
  canonicalTableNames,
} from "@/lib/blueprint-engine/extract/build-feature-blueprint";
export type { FeatureRequestInput } from "@/lib/blueprint-engine/extract/build-feature-blueprint";
export {
  ensureFeatureBlueprint,
  saveFeatureBlueprint,
  getLinkedProjectBlueprint,
} from "@/lib/blueprint-engine/feature-blueprint-service";
export {
  renderFeatureDocument,
  serializeFeatureQaOpsForPrompt,
  FEATURE_DOCUMENT_TYPES,
} from "@/lib/blueprint-engine/render/render-feature-document";
export type { FeatureDocumentType as RenderFeatureDocumentType } from "@/lib/blueprint-engine/render/render-feature-document";
export {
  validateFeatureDocuments,
  featureConsistencyErrorsForDocument,
} from "@/lib/blueprint-engine/validate/feature-validation";
export {
  assignRemediationRequirementIds,
  buildSecurityScanModel,
  remediationRequirementsFromFindings,
} from "@/lib/blueprint-engine/plan/security-remediation-planner";
export type { FindingWithRemediationId } from "@/lib/blueprint-engine/plan/security-remediation-planner";
export {
  buildSecurityFixValidationReport,
  validateConfirmedFindingCoverage,
  validateSecurityFixAgainstBlueprint,
  findingMentionedInPrd,
} from "@/lib/blueprint-engine/validate/security-fix-validation";
export type { SecurityFixValidationReport } from "@/lib/blueprint-engine/validate/security-fix-validation";
export {
  getLinkedProjectBlueprintForScan,
  getProjectSecurityBlueprintContent,
  validateSecurityFixPrd,
  validateSecurityFixPrdForProject,
  parseSecurityScanModel,
} from "@/lib/blueprint-engine/security-scan-service";
export type {
  ArchitectCriticResult,
  CriticDocument,
  GenerateDocumentFn,
} from "@/lib/blueprint-engine/critic/critic-orchestrator";
export type {
  ProjectBlueprint,
  FeatureBlueprint,
  SecurityScanModel,
  ValidationIssue,
} from "@/lib/zod/blueprint-schemas";
export {
  projectBlueprintSchema,
  featureBlueprintSchema,
  securityScanModelSchema,
} from "@/lib/zod/blueprint-schemas";
