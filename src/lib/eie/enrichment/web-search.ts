import {
  AUTHORITATIVE_DOMAINS,
  authoritativeDomainHint,
  isAuthoritativeHostname,
  normalizeHostname,
} from "@/lib/eie/enrichment/allowlist";
import type { ConceptSeed } from "@/lib/eie/types/enrichment";
import type { EieCreditAccumulator } from "@/lib/eie/ai-credits";
import { openrouter, DEFAULT_MODEL } from "@/lib/openrouter";
import { assertPublicUrl } from "@/lib/eie/security/url-validator";

export type SearchHit = {
  title: string;
  url: string;
};

function buildSearchQuery(seed: ConceptSeed): string {
  const tagHint = seed.tags?.slice(0, 3).join(" ") ?? "";
  return [seed.conceptName, seed.category.replace(/_/g, " "), tagHint, "official documentation"]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function filterAuthoritativeHits(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  const filtered: SearchHit[] = [];

  for (const hit of hits) {
    try {
      const url = new URL(hit.url);
      if (!isAuthoritativeHostname(url.hostname)) continue;
      const key = normalizeHostname(url.hostname) + url.pathname;
      if (seen.has(key)) continue;
      seen.add(key);
      filtered.push({ title: hit.title || url.hostname, url: url.href });
    } catch {
      continue;
    }
  }

  return filtered.slice(0, 3);
}

async function searchWithTavily(query: string, domains: string[]): Promise<SearchHit[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      include_domains: domains,
      max_results: 5,
    }),
  });

  if (!res.ok) return [];

  const json = (await res.json()) as {
    results?: { title?: string; url?: string }[];
  };

  return filterAuthoritativeHits(
    (json.results ?? []).map((item) => ({
      title: item.title ?? "Documentation",
      url: item.url ?? "",
    }))
  );
}

async function searchWithSerper(query: string): Promise<SearchHit[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({
      q: `${query} site:owasp.org OR site:developer.mozilla.org OR site:datatracker.ietf.org OR site:learn.microsoft.com`,
      num: 8,
    }),
  });

  if (!res.ok) return [];

  const json = (await res.json()) as {
    organic?: { title?: string; link?: string }[];
  };

  return filterAuthoritativeHits(
    (json.organic ?? []).map((item) => ({
      title: item.title ?? "Documentation",
      url: item.link ?? "",
    }))
  );
}

async function searchWithLlmFallback(
  seed: ConceptSeed,
  domains: string[],
  credits?: EieCreditAccumulator
): Promise<SearchHit[]> {
  const completion = await openrouter.chat.completions.create({
    model: DEFAULT_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Return JSON: { "results": [{ "title": string, "url": string }] }
Suggest up to 3 authoritative public documentation URLs for the engineering concept.
URLs MUST use only these domains: ${domains.join(", ")}
Do not invent blog posts or video links. Prefer standards, official vendor docs, and spec pages.`,
      },
      {
        role: "user",
        content: `Concept: ${seed.conceptName}\nCategory: ${seed.category}\nContext: ${seed.sourceContext}`,
      },
    ],
    max_tokens: 800,
  });

  credits?.recordChatUsage(completion.usage);

  const content = completion.choices[0]?.message?.content;
  if (!content) return [];

  try {
    const parsed = JSON.parse(content) as { results?: SearchHit[] };
    const validated: SearchHit[] = [];

    for (const hit of parsed.results ?? []) {
      try {
        const url = await assertPublicUrl(hit.url);
        if (!isAuthoritativeHostname(url.hostname)) continue;
        validated.push({ title: hit.title, url: url.href });
      } catch {
        continue;
      }
    }

    return filterAuthoritativeHits(validated);
  } catch {
    return [];
  }
}

export async function searchAuthoritativeSources(
  seed: ConceptSeed,
  credits?: EieCreditAccumulator
): Promise<{
  hits: SearchHit[];
  query: string;
  provider: "tavily" | "serper" | "llm_fallback" | "none";
}> {
  const query = buildSearchQuery(seed);
  const domains = authoritativeDomainHint(seed.category);

  let hits = await searchWithTavily(query, domains);
  if (hits.length > 0) {
    return { hits, query, provider: "tavily" };
  }

  hits = await searchWithSerper(query);
  if (hits.length > 0) {
    return { hits, query, provider: "serper" };
  }

  hits = await searchWithLlmFallback(seed, [...AUTHORITATIVE_DOMAINS], credits);
  if (hits.length > 0) {
    return { hits, query, provider: "llm_fallback" };
  }

  return { hits: [], query, provider: "none" };
}
