"use client";

import { useCallback, useEffect, useState } from "react";
import { EIE_CATEGORIES } from "@/lib/eie/constants";
import { ConceptCard, type ConceptCardData } from "@/components/eie/concept-card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function LearningHubCatalog() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [rows, setRows] = useState<ConceptCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConcepts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("query", query.trim());
      if (category) params.set("category", category);
      const res = await fetch(`/api/eie/library?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to load library");
      setRows(data.data.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load library");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [query, category]);

  useEffect(() => {
    const timer = setTimeout(loadConcepts, 300);
    return () => clearTimeout(timer);
  }, [loadConcepts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search concepts..."
          className="max-w-md"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategory(null)}
          className={cn(
            "rounded-lg border px-3 py-1 text-xs font-medium transition-colors",
            category === null
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          All
        </button>
        {EIE_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={cn(
              "rounded-lg border px-3 py-1 text-xs font-medium capitalize transition-colors",
              category === cat
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {cat.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No published concepts match your criteria. Refine your search or ask an administrator to publish concepts.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((concept) => (
            <ConceptCard key={concept.slug ?? concept.conceptName} concept={concept} />
          ))}
        </div>
      )}
    </div>
  );
}
