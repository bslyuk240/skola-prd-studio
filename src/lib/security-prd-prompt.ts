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
For each item: what to check, how to check it, what a passing result looks like.

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
Checkboxes for every verification step after implementation.

Format in clean, professional Markdown. Be specific. Reference actual file paths where detected. Every issue must have a concrete, actionable fix.`;
}
