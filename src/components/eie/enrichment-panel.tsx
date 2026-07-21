"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatEieCategory } from "@/lib/eie/constants";
import type { DocumentEieRetrieval } from "@/lib/eie/retrievals";

type EieEnrichmentPanelProps = {
  retrievals: DocumentEieRetrieval[];
};

export function EieEnrichmentPanel({ retrievals }: EieEnrichmentPanelProps) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            EIE References
            {retrievals.length > 0 ? (
              <Badge variant="outline" className="ml-1 text-xs">
                {retrievals.length}
              </Badge>
            ) : null}
          </Button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-base font-semibold">EIE References</SheetTitle>
          <SheetDescription className="text-sm">
            Engineering concepts referenced during document generation
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {retrievals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No engineering concepts were retrieved for this document. Regenerate with EIE
              cross-referencing enabled after concepts are published.
            </p>
          ) : (
            retrievals.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-border p-4 transition-shadow hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{item.conceptName}</p>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {Number(item.relevanceScore).toFixed(2)}
                  </Badge>
                </div>
                <Badge variant="outline" className="mt-2 text-xs capitalize">
                  {formatEieCategory(item.category)}
                </Badge>
                <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                  {item.summary}
                </p>
                <Link
                  href={`/learning-hub/${item.slug}`}
                  className="mt-3 inline-block text-sm text-primary hover:underline"
                >
                  Open in Learning Hub
                </Link>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
