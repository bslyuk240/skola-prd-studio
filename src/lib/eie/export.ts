import type { PublicKnowledgeConcept } from "@/lib/eie/public-serializer";
import {
  formatTradeOffLine,
} from "@/lib/eie/format-synthesis-fields";

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item : JSON.stringify(item)));
}

function asTradeOffs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(formatTradeOffLine);
}

export function conceptToMarkdown(concept: PublicKnowledgeConcept): string {
  const sections = [
    `# ${concept.conceptName}`,
    ``,
    `**Category:** ${concept.category}`,
    concept.tags?.length ? `**Tags:** ${concept.tags.join(", ")}` : null,
    ``,
    `## Engineering Summary`,
    concept.summary,
    ``,
    `## Practical Explanation`,
    concept.practicalExplanation,
    ``,
    `## Best Practices`,
    ...asStringList(concept.bestPractices).map((item) => `- ${item}`),
    ``,
    `## Trade-offs`,
    ...asTradeOffs(concept.tradeOffs).map((item) => `- ${item}`),
    ``,
    `## Alternative Approaches`,
    ...asStringList(concept.alternativeApproaches).map((item) => `- ${item}`),
    ``,
    `## Security Considerations`,
    ...asStringList(concept.securityConsiderations).map((item) => `- ${item}`),
    ``,
    `## Common Mistakes`,
    ...asStringList(concept.commonMistakes).map((item) => `- ${item}`),
    ``,
    `## Implementation Recommendations`,
    typeof concept.implementationRecommendations === "object"
      ? "```json\n" +
        JSON.stringify(concept.implementationRecommendations, null, 2) +
        "\n```"
      : String(concept.implementationRecommendations),
    ``,
    `## References`,
    ...(Array.isArray(concept.references)
      ? concept.references.map((ref) => {
          if (ref && typeof ref === "object" && "title" in ref) {
            const r = ref as { title: string; url?: string };
            return r.url ? `- [${r.title}](${r.url})` : `- ${r.title}`;
          }
          return `- ${JSON.stringify(ref)}`;
        })
      : []),
  ];

  return sections.filter((line) => line !== null).join("\n");
}
