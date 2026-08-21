type SecurityToggleMap = Record<string, boolean> | null | undefined;

export function countSecurityTodosFromWizard(wizardData: unknown): {
  openSecurityTodos: number;
  totalSecurityTodos: number;
} {
  const toggles = (wizardData as { securityToggles?: SecurityToggleMap })?.securityToggles;
  if (!toggles) {
    return { openSecurityTodos: 0, totalSecurityTodos: 0 };
  }

  const entries = Object.entries(toggles);
  return {
    totalSecurityTodos: entries.length,
    openSecurityTodos: entries.filter(([, enabled]) => !enabled).length,
  };
}

export function mergeSecurityTodoCounts(
  fromChecks: { openSecurityTodos: number; totalSecurityTodos: number },
  fromWizard: { openSecurityTodos: number; totalSecurityTodos: number }
): { openSecurityTodos: number; totalSecurityTodos: number } {
  if (fromChecks.totalSecurityTodos > 0) {
    return fromChecks;
  }
  return fromWizard;
}
