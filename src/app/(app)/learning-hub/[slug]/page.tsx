import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { eieConceptRelationships, eiePublishedKnowledge } from "@/db/schema";
import { eq, inArray, or } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { formatEieCategory } from "@/lib/eie/constants";
import { incrementPublishedViews } from "@/lib/eie/search";
import { ConceptCard } from "@/components/eie/concept-card";
import { LearningHubSectionNav } from "@/components/eie/learning-hub-section-nav";

import { formatTradeOffLine } from "@/lib/eie/format-synthesis-fields";

type PageProps = { params: Promise<{ slug: string }> };

function asLines(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" ? item : JSON.stringify(item)));
  }
  if (typeof value === "string") return [value];
  return [];
}

function asTradeOffLines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(formatTradeOffLine);
}

export default async function LearningHubConceptPage({ params }: PageProps) {
  const { slug } = await params;

  const [concept] = await db
    .select()
    .from(eiePublishedKnowledge)
    .where(eq(eiePublishedKnowledge.slug, slug))
    .limit(1);

  if (!concept) notFound();

  await incrementPublishedViews(slug);

  const relationships = await db
    .select()
    .from(eieConceptRelationships)
    .where(
      or(
        eq(eieConceptRelationships.sourceKnowledgeId, concept.id),
        eq(eieConceptRelationships.targetKnowledgeId, concept.id)
      )
    );

  const relatedIds = relationships.map((rel) =>
    rel.sourceKnowledgeId === concept.id
      ? rel.targetKnowledgeId
      : rel.sourceKnowledgeId
  );

  const related =
    relatedIds.length > 0
      ? await db
          .select()
          .from(eiePublishedKnowledge)
          .where(inArray(eiePublishedKnowledge.id, relatedIds))
      : [];

  const sections = [
    { title: "Engineering Summary", content: concept.summary },
    { title: "Practical Explanation", content: concept.practicalExplanation },
    { title: "Best Practices", items: asLines(concept.bestPractices) },
    { title: "Trade-offs", items: asTradeOffLines(concept.tradeOffs) },
    { title: "Alternative Approaches", items: asLines(concept.alternativeApproaches) },
    { title: "Security Considerations", items: asLines(concept.securityConsiderations) },
    { title: "Common Mistakes", items: asLines(concept.commonMistakes) },
    {
      title: "Implementation Recommendations",
      content:
        typeof concept.implementationRecommendations === "object"
          ? JSON.stringify(concept.implementationRecommendations, null, 2)
          : String(concept.implementationRecommendations),
    },
  ];

  const sectionLinks = sections.map((section) => ({
    title: section.title,
    id: section.title.toLowerCase().replace(/\s+/g, "-"),
  }));

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/learning-hub" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Learning Hub
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{concept.conceptName}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="outline" className="capitalize">
            {formatEieCategory(concept.category)}
          </Badge>
          {concept.tags?.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid min-w-0 gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <LearningHubSectionNav sections={sectionLinks} />

        <div className="space-y-8">
          {sections.map((section) => (
            <section
              key={section.title}
              id={section.title.toLowerCase().replace(/\s+/g, "-")}
              className="scroll-mt-8"
            >
              <h2 className="text-base font-semibold">{section.title}</h2>
              {"content" in section && section.content ? (
                section.title === "Implementation Recommendations" ? (
                  <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-muted/30 p-4 text-xs">
                    {section.content}
                  </pre>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">
                    {section.content}
                  </p>
                )
              ) : null}
              {"items" in section && section.items ? (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}

          {related.length > 0 ? (
            <section>
              <h2 className="text-base font-semibold">Related Concepts</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {related.map((item) => (
                  <ConceptCard
                    key={item.id}
                    concept={{
                      slug: item.slug,
                      conceptName: item.conceptName,
                      summary: item.summary,
                      category: item.category,
                      tags: item.tags,
                    }}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
