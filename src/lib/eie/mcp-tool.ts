import { searchPublished, searchPublishedByVector } from "@/lib/eie/search";
import { toPublicConceptList } from "@/lib/eie/public-serializer";
import { queryEngineeringKnowledgeParams } from "@/lib/validators/mcp";
import { EIE_CATEGORIES } from "@/lib/eie/constants";
import { z } from "zod";

export type QueryEngineeringKnowledgeArgs = z.infer<
  typeof queryEngineeringKnowledgeParams
>;

export type McpToolResult = {
  concepts: ReturnType<typeof toPublicConceptList>;
  totalMatches: number;
};

export async function handleQueryEngineeringKnowledge(
  args: QueryEngineeringKnowledgeArgs
): Promise<McpToolResult> {
  const limit = args.limit ?? 5;

  const vectorMatches = await searchPublishedByVector(args.searchQuery, limit);
  let rows = vectorMatches.map(({ row }) => row);

  if (args.category) {
    rows = rows.filter((row) => row.category === args.category);
  }

  if (rows.length === 0) {
    const category =
      args.category &&
      (EIE_CATEGORIES as readonly string[]).includes(args.category)
        ? (args.category as (typeof EIE_CATEGORIES)[number])
        : undefined;

    const fallback = await searchPublished({
      query: args.searchQuery,
      category,
      tags: undefined,
      page: 1,
      limit,
    });
    rows = fallback.rows;
  }

  return {
    concepts: toPublicConceptList(rows.slice(0, limit)),
    totalMatches: rows.length,
  };
}
