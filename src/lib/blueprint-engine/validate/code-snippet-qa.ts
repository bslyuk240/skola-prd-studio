import ts from "typescript";
import type { ValidationIssue } from "@/lib/zod/blueprint-schemas";

export type FencedCodeBlock = {
  language: string;
  code: string;
  startIndex: number;
  endIndex: number;
  lineNumber: number;
};

const FENCE_PATTERN = /```([^\n`]*)\r?\n([\s\S]*?)```/g;

const MERMAID_DIAGRAM_TYPES = [
  "graph",
  "flowchart",
  "sequenceDiagram",
  "classDiagram",
  "stateDiagram-v2",
  "stateDiagram",
  "erDiagram",
  "journey",
  "gantt",
  "pie",
  "gitGraph",
  "mindmap",
  "timeline",
  "quadrantChart",
  "requirementDiagram",
  "C4Context",
  "C4Container",
  "C4Component",
  "C4Dynamic",
  "C4Deployment",
];

const SQL_KEYWORDS =
  /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TABLE|INDEX|VIEW|FROM|WHERE|JOIN|GRANT|REVOKE|BEGIN|COMMIT|ROLLBACK|WITH|INTO|VALUES|SET|CONSTRAINT|PRIMARY|FOREIGN|KEY|UNIQUE|NOT NULL|DEFAULT)\b/i;

const VALIDATED_LANGUAGES = new Set([
  "mermaid",
  "sql",
  "postgresql",
  "postgres",
  "mysql",
  "typescript",
  "ts",
  "javascript",
  "js",
  "json",
]);

function lineNumberAt(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function normalizeLanguage(raw: string): string {
  const token = raw.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (token === "postgresql" || token === "postgres") return "sql";
  if (token === "ts") return "typescript";
  if (token === "js") return "javascript";
  return token;
}

function shouldValidateLanguage(language: string): boolean {
  return VALIDATED_LANGUAGES.has(language);
}

export function extractFencedCodeBlocks(content: string): FencedCodeBlock[] {
  const blocks: FencedCodeBlock[] = [];
  FENCE_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = FENCE_PATTERN.exec(content)) !== null) {
    const language = normalizeLanguage(match[1] ?? "");
    blocks.push({
      language,
      code: match[2] ?? "",
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      lineNumber: lineNumberAt(content, match.index),
    });
  }

  return blocks;
}

function balancedPairs(text: string, open: string, close: string): boolean {
  let depth = 0;
  for (const char of text) {
    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

function balancedQuotes(text: string, quote: string): boolean {
  let escaped = false;
  let open = false;
  for (const char of text) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === quote) open = !open;
  }
  return !open;
}

export function validateMermaid(code: string): string | null {
  const trimmed = code.trim();
  if (!trimmed) return "Empty Mermaid diagram";

  const firstLine = trimmed.split(/\r?\n/)[0]?.trim() ?? "";
  const diagramType = MERMAID_DIAGRAM_TYPES.find(
    (type) => firstLine === type || firstLine.startsWith(`${type} `) || firstLine.startsWith(`${type}\t`)
  );
  if (!diagramType) {
    return `Unrecognized Mermaid diagram header: "${firstLine.slice(0, 60)}"`;
  }

  if (!balancedPairs(trimmed, "(", ")")) return "Unbalanced parentheses in Mermaid diagram";
  if (!balancedPairs(trimmed, "[", "]")) return "Unbalanced brackets in Mermaid diagram";
  if (!balancedPairs(trimmed, "{", "}")) return "Unbalanced braces in Mermaid diagram";

  for (const [index, line] of trimmed.split(/\r?\n/).entries()) {
    const normalized = line.trim();
    if (!normalized) continue;
    if (/(-{1,2}|={1,2}|\.{2,})>\s*$/.test(normalized)) {
      return `Incomplete edge on line ${index + 1}`;
    }
    if (/(--|==|\.\.)\s*$/.test(normalized)) {
      return `Incomplete connector on line ${index + 1}`;
    }
    if (/^\s*(-->|==>|---)\s*$/.test(normalized)) {
      return `Dangling connector on line ${index + 1}`;
    }
  }

  return null;
}

export function validateSql(code: string): string | null {
  const trimmed = code.trim();
  if (!trimmed) return "Empty SQL snippet";

  if (!balancedPairs(trimmed, "(", ")")) return "Unbalanced parentheses in SQL snippet";
  if (!balancedQuotes(trimmed, "'")) return "Unclosed single-quoted string in SQL snippet";
  if (!balancedQuotes(trimmed, '"')) return "Unclosed double-quoted identifier in SQL snippet";

  if (trimmed.length > 24 && !SQL_KEYWORDS.test(trimmed)) {
    return "SQL snippet does not contain recognizable SQL keywords";
  }

  return null;
}

export function validateJson(code: string): string | null {
  const trimmed = code.trim();
  if (!trimmed) return "Empty JSON snippet";

  try {
    JSON.parse(trimmed);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    return message;
  }
}

function validateScriptSyntax(code: string, kind: ts.ScriptKind): string | null {
  const trimmed = code.trim();
  if (!trimmed) return "Empty code snippet";

  const fileName = kind === ts.ScriptKind.JS ? "snippet.js" : "snippet.ts";
  const result = ts.transpileModule(trimmed, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      ...(kind === ts.ScriptKind.JS ? { allowJs: true } : {}),
    },
    reportDiagnostics: true,
    fileName,
  });

  const diagnostics = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error
  );
  if (diagnostics.length === 0) return null;

  const diagnostic = diagnostics[0];
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
  if (diagnostic.file && typeof diagnostic.start === "number") {
    const { line } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    return `Line ${line + 1}: ${message}`;
  }
  return message;
}

export function validateTypeScript(code: string): string | null {
  return validateScriptSyntax(code, ts.ScriptKind.TS);
}

export function validateJavaScript(code: string): string | null {
  return validateScriptSyntax(code, ts.ScriptKind.JS);
}

export function validateCodeSnippet(language: string, code: string): { valid: boolean; error?: string } {
  const normalized = normalizeLanguage(language);
  if (!shouldValidateLanguage(normalized)) {
    return { valid: true };
  }

  let error: string | null = null;
  switch (normalized) {
    case "mermaid":
      error = validateMermaid(code);
      break;
    case "sql":
      error = validateSql(code);
      break;
    case "json":
      error = validateJson(code);
      break;
    case "typescript":
      error = validateTypeScript(code);
      break;
    case "javascript":
      error = validateJavaScript(code);
      break;
    default:
      break;
  }

  return error ? { valid: false, error } : { valid: true };
}

function formatLanguageLabel(language: string): string {
  switch (language) {
    case "mermaid":
      return "Mermaid";
    case "sql":
      return "SQL";
    case "typescript":
      return "TypeScript";
    case "javascript":
      return "JavaScript";
    case "json":
      return "JSON";
    default:
      return language.toUpperCase();
  }
}

function buildRemovalNotice(language: string, error: string): string {
  const label = formatLanguageLabel(language);
  return `> **Code snippet removed:** Invalid ${label} — ${error}. Add a corrected snippet here.\n`;
}

function snippetIssueId(documentType: string, lineNumber: number, language: string): string {
  return `SNIPPET-${documentType}-${language}-${lineNumber}`;
}

export function codeSnippetIssuesFromContent(
  content: string,
  documentType: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const block of extractFencedCodeBlocks(content)) {
    if (!shouldValidateLanguage(block.language)) continue;

    const result = validateCodeSnippet(block.language, block.code);
    if (result.valid || !result.error) continue;

    issues.push({
      id: snippetIssueId(documentType, block.lineNumber, block.language),
      severity: "warning",
      category: "code_snippets",
      message: `Invalid ${formatLanguageLabel(block.language)} snippet near line ${block.lineNumber}: ${result.error}`,
      resolution: "Regenerate the document section or replace the snippet with valid syntax",
      documentTypes: [documentType],
    });
  }

  return issues;
}

export function stripInvalidCodeSnippets(
  content: string,
  documentType: string
): { content: string; issues: ValidationIssue[] } {
  const blocks = extractFencedCodeBlocks(content);
  const issues: ValidationIssue[] = [];
  let nextContent = content;

  for (const block of [...blocks].sort((a, b) => b.startIndex - a.startIndex)) {
    if (!shouldValidateLanguage(block.language)) continue;

    const result = validateCodeSnippet(block.language, block.code);
    if (result.valid || !result.error) continue;

    issues.push({
      id: snippetIssueId(documentType, block.lineNumber, block.language),
      severity: "warning",
      category: "code_snippets",
      message: `Invalid ${formatLanguageLabel(block.language)} snippet near line ${block.lineNumber}: ${result.error}`,
      resolution: "Regenerate the document section or replace the snippet with valid syntax",
      documentTypes: [documentType],
    });

    const replacement = buildRemovalNotice(block.language, result.error);
    nextContent =
      nextContent.slice(0, block.startIndex) + replacement + nextContent.slice(block.endIndex);
  }

  return { content: nextContent, issues };
}

export function sanitizeDocumentsCodeSnippets<T extends { type: string; content: string }>(
  documents: T[]
): { documents: T[]; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const sanitized = documents.map((doc) => {
    const result = stripInvalidCodeSnippets(doc.content, doc.type);
    issues.push(...result.issues);
    return { ...doc, content: result.content };
  });

  return { documents: sanitized, issues };
}
