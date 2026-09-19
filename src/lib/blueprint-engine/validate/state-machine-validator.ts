import type { ProjectBlueprint, ValidationIssue } from "@/lib/zod/blueprint-schemas";
import type { DocumentSnapshot } from "@/lib/blueprint-engine/validate/readiness";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const TRANSITION_PATTERN =
  /\b([A-Z][A-Z0-9_]*)\s*(?:→|->|—>|to)\s*([A-Z][A-Z0-9_]*)\b/g;

const PREMATURE_EXECUTION_PATTERN =
  /\b(executed|has been executed|action completed|successfully completed)\b/i;

function workflowIssue(
  id: string,
  message: string,
  resolution: string,
  documentTypes: string[]
): ValidationIssue {
  return {
    id,
    severity: "error",
    category: "state_machine",
    message: message.startsWith("STATE MACHINE ERROR:")
      ? message
      : `STATE MACHINE ERROR: ${message}`,
    resolution,
    documentTypes,
  };
}

function transitionKey(from: string, to: string): string {
  return `${from}->${to}`;
}

function mentionIsInTransitionChain(content: string, index: number): boolean {
  const lineStart = content.lastIndexOf("\n", index) + 1;
  const lineEnd = content.indexOf("\n", index);
  const line = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd);
  return /→|->|—>/.test(line);
}

function buildAllowedTransitions(
  blueprint: ProjectBlueprint
): Map<string, { machineId: string; machineName: string }> {
  const allowed = new Map<string, { machineId: string; machineName: string }>();

  for (const machine of blueprint.stateMachines) {
    for (const transition of machine.transitions) {
      allowed.set(transitionKey(transition.from, transition.to), {
        machineId: machine.id,
        machineName: machine.name,
      });
    }
  }

  return allowed;
}

/** Validate canonical state machine definitions (P7-1). */
export function validateStateMachineStructure(blueprint: ProjectBlueprint): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const machine of blueprint.stateMachines) {
    const stateSet = new Set(machine.states);

    for (const terminal of machine.terminalStates) {
      if (!stateSet.has(terminal)) {
        issues.push(
          workflowIssue(
            `SM-STRUCT-TERMINAL-${machine.id}-${terminal}`,
            `Terminal state "${terminal}" is not listed in states for ${machine.id}`,
            `Add "${terminal}" to states or remove it from terminalStates`,
            []
          )
        );
      }
    }

    for (const transition of machine.transitions) {
      if (!stateSet.has(transition.from)) {
        issues.push(
          workflowIssue(
            `SM-STRUCT-FROM-${machine.id}-${transition.from}`,
            `Transition from unknown state "${transition.from}" in ${machine.id}`,
            `Add "${transition.from}" to the state machine states array`,
            []
          )
        );
      }
      if (!stateSet.has(transition.to)) {
        issues.push(
          workflowIssue(
            `SM-STRUCT-TO-${machine.id}-${transition.to}`,
            `Transition to unknown state "${transition.to}" in ${machine.id}`,
            `Add "${transition.to}" to the state machine states array`,
            []
          )
        );
      }
    }

    for (const terminal of machine.terminalStates) {
      const exitsTerminal = machine.transitions.some((transition) => transition.from === terminal);
      if (exitsTerminal) {
        issues.push(
          workflowIssue(
            `SM-STRUCT-EXIT-${machine.id}-${terminal}`,
            `Terminal state "${terminal}" has outbound transitions in ${machine.id}`,
            "Remove transitions that leave terminal states",
            []
          )
        );
      }
    }
  }

  return issues;
}

export function extractDocumentTransitions(content: string): Array<{ from: string; to: string }> {
  const transitions: Array<{ from: string; to: string }> = [];
  const seen = new Set<string>();

  const chainPattern = /([A-Z][A-Z0-9_]*(?:\s*(?:→|->|—>)\s*[A-Z][A-Z0-9_]*)+)/g;
  for (const chainMatch of content.matchAll(chainPattern)) {
    const states = [...chainMatch[1].matchAll(/([A-Z][A-Z0-9_]*)/g)].map((match) => match[1]);
    for (let index = 0; index < states.length - 1; index += 1) {
      const from = states[index];
      const to = states[index + 1];
      const key = transitionKey(from, to);
      if (seen.has(key)) continue;
      seen.add(key);
      transitions.push({ from, to });
    }
  }

  for (const match of content.matchAll(TRANSITION_PATTERN)) {
    const from = match[1];
    const to = match[2];
    const key = transitionKey(from, to);
    if (seen.has(key)) continue;
    seen.add(key);
    transitions.push({ from, to });
  }

  return transitions;
}

/** Validate document transitions and UI copy against canonical machines (P7-2). */
export function validateStateTransitionsInDocument(
  blueprint: ProjectBlueprint,
  content: string,
  documentType: string
): ValidationIssue[] {
  if (blueprint.stateMachines.length === 0) return [];

  const issues: ValidationIssue[] = [];
  const allowed = buildAllowedTransitions(blueprint);
  const allStates = new Set(blueprint.stateMachines.flatMap((machine) => machine.states));
  const terminalStates = new Set(
    blueprint.stateMachines.flatMap((machine) => machine.terminalStates)
  );
  const successStates = new Set(
    blueprint.stateMachines.flatMap((machine) =>
      machine.terminalStates.filter((state) => /SUCCEEDED|COMPLETED|DONE/i.test(state))
    )
  );

  for (const transition of extractDocumentTransitions(content)) {
    if (!allStates.has(transition.from) || !allStates.has(transition.to)) continue;

    const key = transitionKey(transition.from, transition.to);
    if (!allowed.has(key)) {
      const match = [...allowed.entries()].find(([allowedKey]) => allowedKey.startsWith(`${transition.from}->`));
      issues.push(
        workflowIssue(
          `SM-DOC-TRANSITION-${documentType}-${transition.from}-${transition.to}`,
          `Invalid transition ${transition.from} → ${transition.to} in ${documentType}`,
          match
            ? `Use an allowed transition such as ${transition.from} → ${match[0].split("->")[1]}`
            : `Follow the canonical state machine transitions`,
          [documentType]
        )
      );
    }
  }

  if (PREMATURE_EXECUTION_PATTERN.test(content)) {
    const preSuccessStates = [...allStates].filter(
      (state) => !successStates.has(state) && !terminalStates.has(state)
    );

    const hasProximityIssue = preSuccessStates.some((state) => {
      const stateRegex = new RegExp(`\\b${escapeRegExp(state)}\\b`, "gi");
      for (const stateMatch of content.matchAll(stateRegex)) {
        const index = stateMatch.index ?? 0;
        if (mentionIsInTransitionChain(content, index)) continue;

        const start = Math.max(0, index - 200);
        const end = Math.min(content.length, index + stateMatch[0].length + 200);
        const window = content.slice(start, end);
        if (PREMATURE_EXECUTION_PATTERN.test(window)) return true;
      }
      return false;
    });

    if (hasProximityIssue) {
      issues.push(
        workflowIssue(
          `SM-DOC-COPY-${documentType}`,
          `UI copy in ${documentType} implies execution completed before ${[...successStates].join(" or ") || "SUCCEEDED"}`,
          'Use pending/in-progress language until the workflow reaches SUCCEEDED',
          [documentType]
        )
      );
    }
  }

  return issues;
}

export function validateWorkflowDocuments(
  blueprint: ProjectBlueprint,
  documents: DocumentSnapshot[]
): ValidationIssue[] {
  const issues = validateStateMachineStructure(blueprint);

  for (const doc of documents) {
    if (!doc.content?.trim()) continue;
    if (doc.type === "app_flow" || doc.type === "ux_brief" || doc.type === "security_blueprint") {
      issues.push(...validateStateTransitionsInDocument(blueprint, doc.content, doc.type));
    }
  }

  return issues;
}

export function workflowErrorsForDocument(
  issues: ValidationIssue[],
  documentType: string
): ValidationIssue[] {
  return issues.filter(
    (issue) =>
      issue.category === "state_machine" &&
      issue.severity === "error" &&
      issue.documentTypes.includes(documentType)
  );
}
