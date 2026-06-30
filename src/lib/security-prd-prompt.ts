import type { SecurityFinding } from "./security-scanner";
import type { DetectedStack } from "./github-scanner";

export function buildSecurityPrdPrompt(
  repoName: string,
  stack: DetectedStack,
  findings: SecurityFinding[],
  appliedPacks: string[],
  score: number,
  projectSummary: string
): string {
  const confirmed = findings.filter((f) => f.confidence === "confirmed");
  const likelyGaps = findings.filter((f) => f.confidence === "likely_gap");
  const needsReview = findings.filter((f) => f.confidence === "needs_review");
  const recommended = findings.filter((f) => f.confidence === "recommended");

  const findingsList = (items: SecurityFinding[]) =>
    items.map((f) => `### ${f.title}
**Severity:** ${f.severity.toUpperCase()}
**Pack:** ${f.pack}
**Description:** ${f.description}
${f.codeEvidence ? `**Evidence found:** \`${f.codeEvidence}\`` : ""}
**Recommendation:** ${f.recommendation}
${f.affectedFiles?.length ? `**Likely affected files:** ${f.affectedFiles.join(", ")}` : ""}`
    ).join("\n\n");

  return `You are a senior application security engineer writing a Security Fix PRD. Generate a complete, actionable Security Remediation PRD based on the scan results below.

Reference framework: the Amospikins "AI Code Security Checklist v2.0" — 27 checks across 8 categories (A. Foundations, B. Identity & Access Control, C. Input/Output & Injection, D. Secrets & Supply Chain, E. Money & Integrations, F. Operations & Hardening, G. AI-Specific Risks, H. Verify Before You Ship). Map every finding below to the closest checklist item where relevant. Some checklist items are process-only and cannot be detected from code alone — always include these as manual checklist items regardless of scan findings:
- A02: Confirm no real secrets, customer records, or confidential code were pasted into an AI prompt.
- E18: Confirm AI-generated code enforces real business rules, not just technical validity (e.g. a normal user cannot perform an action reserved for a privileged role).
- G24: Re-review security after every AI "improve this" / "make it more secure" edit, not only the first pass — re-prompting does not guarantee safer code.
- H27: A competent human must review and approve the code before production, even after automated checks pass.

PROJECT: ${repoName}
SAFE TO SHIP SCORE: ${score}/100

DETECTED STACK:
${Object.entries(stack).filter(([k, v]) => k !== "otherDeps" && v && v !== "Not detected").map(([k, v]) => `- ${k}: ${v}`).join("\n")}
Other deps: ${stack.otherDeps.join(", ")}

PROJECT SUMMARY:
${projectSummary}

APPLIED SECURITY PACKS: ${appliedPacks.join(", ")}

SCAN FINDINGS:

CONFIRMED ISSUES (${confirmed.length}):
${confirmed.length ? findingsList(confirmed) : "None found."}

LIKELY GAPS (${likelyGaps.length}):
${likelyGaps.length ? findingsList(likelyGaps) : "None found."}

NEEDS MANUAL REVIEW (${needsReview.length}):
${needsReview.length ? findingsList(needsReview) : "None."}

RECOMMENDED IMPROVEMENTS (${recommended.length}):
${recommended.length ? findingsList(recommended) : "None."}

---

Generate a complete Security Fix PRD with these exact sections:

# Security Fix PRD: ${repoName}

## 1. Executive Summary
Safe to Ship Score: ${score}/100
One paragraph describing the overall security posture and most critical issues.

## 2. Project & Stack Overview
Table of detected tech and what security implications each has.

## 3. Scope of This Security Review
What was scanned. What this review CAN confirm. What requires manual verification. What is out of scope (no penetration testing, no runtime analysis).

## 4. Confirmed Issues
For each confirmed issue: severity badge, description, evidence, exact fix required, acceptance criteria.

## 5. Likely Gaps — Implement These
For each likely gap: severity, what's missing, why it matters, how to implement.

## 6. Manual Review Required
For each item: what to check, how to check it, what a passing result looks like. Include the four process-only checklist items (A02, E18, G24, H27) listed above even if no automated finding triggered them.

## 7. Recommended Improvements
Nice-to-have security additions ordered by impact.

## 8. Implementation Priority Order
Numbered list — what to fix first. Critical issues blocking ship, then high priority, then medium.

## 9. Affected Files & Modules
Table: File/Module | Issue | Fix Required

## 10. Acceptance Criteria
Specific, testable criteria. Each fix must have a measurable pass condition.

## 11. Security Test Cases
For each fix, provide a test case:
| Test | How to Test | Pass Condition |

## 12. Suggested AI Agent Prompt
A ready-to-paste prompt the user can give to Cursor, Claude Code, or Windsurf to implement all fixes. It should:
- Reference the actual tech stack
- List every fix in implementation order
- Include the acceptance criteria
- Reference the files that need changing
- Include security constraints the AI must follow

Format this as a markdown code block the user can copy directly.

## 13. Rollback Plan
If security fixes introduce regressions, what to roll back and how.

## 14. Post-Fix Validation Checklist
Checkboxes for every verification step after implementation, including the four process-only items (A02, E18, G24, H27).

Format in clean, professional Markdown. Be specific. Reference actual file paths where detected. Every issue must have a concrete, actionable fix.`;
}
