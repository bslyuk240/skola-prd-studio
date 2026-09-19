/** Runtime list of feature document types — mirrors FeatureDocumentType in generate-feature-document.ts. */
export const featureDocTypeValues = [
  "feature_prd",
  "impact_analysis",
  "schema_changes",
  "api_changes",
  "ui_changes",
  "security_checklist",
  "implementation_tasks",
  "test_plan",
  "deployment_plan",
] as const;
