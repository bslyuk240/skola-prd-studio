import {
  formatImplementationRecommendationsAsLines,
  formatStringArrayAsLines,
  formatTradeOffsAsLines,
} from "@/lib/eie/format-synthesis-fields";

export type DraftFormState = {
  conceptName: string;
  category: string;
  summary: string;
  practicalExplanation: string;
  bestPractices: string;
  tradeOffs: string;
  alternativeApproaches: string;
  securityConsiderations: string;
  commonMistakes: string;
  implementationRecommendations: string;
};

export function draftToFormState(draft: {
  conceptName: string;
  category: string;
  summary: string;
  practicalExplanation: string;
  bestPractices: unknown;
  tradeOffs: unknown;
  alternativeApproaches: unknown;
  securityConsiderations: unknown;
  commonMistakes: unknown;
  implementationRecommendations: unknown;
}): DraftFormState {
  return {
    conceptName: draft.conceptName,
    category: draft.category,
    summary: draft.summary,
    practicalExplanation: draft.practicalExplanation,
    bestPractices: formatStringArrayAsLines(draft.bestPractices),
    tradeOffs: formatTradeOffsAsLines(draft.tradeOffs),
    alternativeApproaches: formatStringArrayAsLines(draft.alternativeApproaches),
    securityConsiderations: formatStringArrayAsLines(draft.securityConsiderations),
    commonMistakes: formatStringArrayAsLines(draft.commonMistakes),
    implementationRecommendations: formatImplementationRecommendationsAsLines(
      draft.implementationRecommendations
    ),
  };
}
