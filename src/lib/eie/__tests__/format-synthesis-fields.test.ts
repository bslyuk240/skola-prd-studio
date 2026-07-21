import { describe, expect, it } from "vitest";
import { draftToFormState } from "@/lib/eie/draft-form-state";
import {
  formatImplementationRecommendationsAsLines,
  formatTradeOffsAsLines,
} from "@/lib/eie/format-synthesis-fields";

describe("formatTradeOffsAsLines", () => {
  it("formats structured trade-off objects", () => {
    const lines = formatTradeOffsAsLines([
      {
        alternative: "Proactive timer-based refresh",
        pro: "Prevents visible API failures",
        con: "Requires background worker infrastructure",
      },
    ]);

    expect(lines).toBe(
      "Proactive timer-based refresh: pro — Prevents visible API failures; con — Requires background worker infrastructure"
    );
  });
});

describe("formatImplementationRecommendationsAsLines", () => {
  it("formats keyed recommendation objects", () => {
    const lines = formatImplementationRecommendationsAsLines({
      middleware: "Check role on every protected route",
      database: "Store role assignments in a join table",
    });

    expect(lines).toContain("middleware: Check role on every protected route");
    expect(lines).toContain("database: Store role assignments in a join table");
    expect(lines).not.toContain("[object Object]");
  });
});

describe("draftToFormState", () => {
  it("maps structured trade-offs into editable text lines", () => {
    const form = draftToFormState({
      conceptName: "JWT Refresh",
      category: "security_compliance",
      summary: "Summary",
      practicalExplanation: "Explanation",
      bestPractices: ["Use short-lived access tokens"],
      tradeOffs: [
        {
          alternative: "Reactive interceptor refresh",
          pro: "Simpler client logic",
          con: "Users may see failed requests",
        },
      ],
      alternativeApproaches: ["Session cookies"],
      securityConsiderations: ["Store refresh tokens in HttpOnly cookies"],
      commonMistakes: ["Storing tokens in localStorage"],
      implementationRecommendations: { recommendations: ["Use a dedicated auth service"] },
    });

    expect(form.tradeOffs).toContain("Reactive interceptor refresh");
    expect(form.tradeOffs).not.toContain("[object Object]");
  });
});
