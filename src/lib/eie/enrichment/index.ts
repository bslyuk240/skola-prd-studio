import { fetchRemoteDocument } from "@/lib/eie/parsers/url";
import { extractRelevantExcerpt } from "@/lib/eie/enrichment/excerpt";
import { normalizeHostname } from "@/lib/eie/enrichment/allowlist";
import { searchAuthoritativeSources, type SearchHit } from "@/lib/eie/enrichment/web-search";
import type { ConceptEnrichment, ConceptSeed } from "@/lib/eie/types/enrichment";
import type { EieCreditAccumulator } from "@/lib/eie/ai-credits";
import { assertPublicUrl } from "@/lib/eie/security/url-validator";
import { isAuthoritativeHostname } from "@/lib/eie/enrichment/allowlist";

async function fetchAuthoritativeExcerpt(
  hit: SearchHit,
  seed: ConceptSeed
): Promise<{ title: string; url: string; excerpt: string; domain: string } | null> {
  try {
    const url = await assertPublicUrl(hit.url);
    if (!isAuthoritativeHostname(url.hostname)) return null;

    const text = await fetchRemoteDocument(url.href);
    const excerpt = extractRelevantExcerpt(text, seed.conceptName, seed.tags ?? []);
    if (excerpt.length < 80) return null;

    return {
      title: hit.title,
      url: url.href,
      excerpt,
      domain: normalizeHostname(url.hostname),
    };
  } catch {
    return null;
  }
}

export async function enrichConceptFromAuthoritativeSources(
  seed: ConceptSeed,
  credits?: EieCreditAccumulator
): Promise<ConceptEnrichment> {
  const { hits, query, provider } = await searchAuthoritativeSources(seed, credits);

  if (hits.length === 0) {
    return {
      sources: [],
      searchQuery: query,
      provider,
      warning:
        "No authoritative public documentation was found. Synthesis will rely on ingested source text only.",
    };
  }

  const sources = [];
  for (const hit of hits) {
    const fetched = await fetchAuthoritativeExcerpt(hit, seed);
    if (fetched) sources.push(fetched);
  }

  if (sources.length === 0) {
    return {
      sources: [],
      searchQuery: query,
      provider,
      warning:
        "Authoritative URLs were found but could not be fetched or parsed. Synthesis will rely on ingested source text only.",
    };
  }

  return {
    sources,
    searchQuery: query,
    provider,
  };
}
