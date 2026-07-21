"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEieCategory } from "@/lib/eie/constants";
import { cn } from "@/lib/utils";

export type ConceptCardData = {
  slug?: string;
  id?: string;
  conceptName: string;
  summary: string;
  category: string;
  tags?: string[] | null;
  status?: string;
};

type ConceptCardProps = {
  concept: ConceptCardData;
  href?: string;
  variant?: "library" | "admin";
};

export function ConceptCard({ concept, href, variant = "library" }: ConceptCardProps) {
  const linkHref =
    href ??
    (concept.slug
      ? `/learning-hub/${concept.slug}`
      : concept.id
        ? `/admin/eie/review/${concept.id}`
        : "#");

  return (
    <Link href={linkHref}>
      <Card className="h-full transition-shadow hover:shadow-sm">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-semibold">{concept.conceptName}</CardTitle>
            {variant === "admin" && concept.status ? (
              <Badge variant="outline" className="text-xs capitalize">
                {concept.status.replace(/_/g, " ")}
              </Badge>
            ) : null}
          </div>
          <Badge variant="outline" className="w-fit text-xs capitalize">
            {formatEieCategory(concept.category)}
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-3">{concept.summary}</p>
          {concept.tags?.length ? (
            <div className="mt-3 flex flex-wrap gap-1">
              {concept.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className={cn(
                    "rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  )}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}
