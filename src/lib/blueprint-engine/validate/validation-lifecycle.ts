export type CategoryValidationState = "pending" | "pass" | "fail";

export type DocumentWithStatus = {
  type: string;
  status: string | null;
  content?: string | null;
};

export type ValidationGateKey =
  | "schema"
  | "flow"
  | "security"
  | "integrations"
  | "conflicts"
  | "assumptions";

/** Source document that must be complete before a category is scored. */
export const CATEGORY_SOURCE_DOCUMENT: Partial<Record<ValidationGateKey, string>> = {
  schema: "backend_schema",
  flow: "app_flow",
  security: "security_blueprint",
  integrations: "api_integration_spec",
};

export function isDocumentComplete(doc: DocumentWithStatus): boolean {
  return (
    doc.status === "ready" ||
    doc.status === "approved" ||
    Boolean(doc.content?.trim())
  );
}

export function isDocumentGenerating(doc: DocumentWithStatus): boolean {
  return doc.status === "generating";
}

export function isGenerationInProgress(documents: DocumentWithStatus[]): boolean {
  return documents.some(isDocumentGenerating);
}

export function findDocument(
  documents: DocumentWithStatus[],
  type: string
): DocumentWithStatus | undefined {
  return documents.find((doc) => doc.type === type);
}

export function canValidateCategory(
  key: ValidationGateKey,
  documents: DocumentWithStatus[]
): boolean {
  if (key === "assumptions") return true;

  if (key === "conflicts") {
    const readyCount = documents.filter(isDocumentComplete).length;
    if (readyCount >= 2) return true;
    return documents.length > 0 && !isGenerationInProgress(documents);
  }

  const sourceType = CATEGORY_SOURCE_DOCUMENT[key];
  if (!sourceType) return true;

  const source = findDocument(documents, sourceType);
  return source ? isDocumentComplete(source) : false;
}

export function buildCategoryValidationStates(
  documents: DocumentWithStatus[],
  categoryErrors: Partial<Record<ValidationGateKey, number>>,
  categoryWarnings: Partial<Record<ValidationGateKey, number>> = {}
): Record<ValidationGateKey, CategoryValidationState> {
  const keys: ValidationGateKey[] = [
    "schema",
    "flow",
    "conflicts",
    "assumptions",
    "security",
    "integrations",
  ];

  return Object.fromEntries(
    keys.map((key) => {
      if (!canValidateCategory(key, documents)) {
        return [key, "pending"];
      }
      const errors = categoryErrors[key] ?? 0;
      if (errors > 0) return [key, "fail"];
      const warnings = categoryWarnings[key] ?? 0;
      if (warnings > 0) return [key, "pass"];
      return [key, "pass"];
    })
  ) as Record<ValidationGateKey, CategoryValidationState>;
}

export function issueBelongsToCategory(
  category: string,
  gate: ValidationGateKey
): boolean {
  switch (gate) {
    case "schema":
      return ["structural_completeness", "entity_registry", "model_completeness"].includes(
        category
      );
    case "flow":
      return category === "state_machine";
    case "security":
      return ["security", "ai_action_policy", "qa_coverage"].includes(category);
    case "integrations":
      return category === "integration_verification";
    case "conflicts":
      return ["consistency", "terminology", "architecture", "code_snippets"].includes(
        category
      );
    case "assumptions":
      return ["assumption", "assumptions"].includes(category);
    default:
      return false;
  }
}

export function filterIssuesForLifecycle<T extends { category: string }>(
  issues: T[],
  documents: DocumentWithStatus[]
): T[] {
  const gates: ValidationGateKey[] = [
    "schema",
    "flow",
    "security",
    "integrations",
    "conflicts",
    "assumptions",
  ];

  return issues.filter((issue) => {
    if (issue.category === "model_completeness") return true;

    for (const gate of gates) {
      if (!issueBelongsToCategory(issue.category, gate)) continue;
      return canValidateCategory(gate, documents);
    }
    return true;
  });
}
