function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function scoreParagraph(paragraph: string, keywords: Set<string>): number {
  const tokens = tokenize(paragraph);
  if (tokens.length === 0) return 0;

  let hits = 0;
  for (const token of tokens) {
    if (keywords.has(token)) hits += 1;
  }

  return hits / tokens.length;
}

export function extractRelevantExcerpt(
  text: string,
  conceptName: string,
  tags: string[] = [],
  maxChars = 3500
): string {
  const trimmed = text.replace(/\r\n/g, "\n").trim();
  if (trimmed.length <= maxChars) return trimmed;

  const keywords = new Set([
    ...tokenize(conceptName),
    ...tags.flatMap((tag) => tokenize(tag)),
  ]);

  const paragraphs = trimmed
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length > 40);

  if (paragraphs.length === 0) {
    return trimmed.slice(0, maxChars);
  }

  const ranked = paragraphs
    .map((paragraph, index) => ({
      paragraph,
      index,
      score: scoreParagraph(paragraph, keywords),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const selected: string[] = [];
  let total = 0;

  for (const item of ranked) {
    if (total + item.paragraph.length > maxChars) continue;
    selected.push(item.paragraph);
    total += item.paragraph.length + 2;
    if (total >= maxChars * 0.7) break;
  }

  if (selected.length === 0) {
    return trimmed.slice(0, maxChars);
  }

  return selected.join("\n\n").slice(0, maxChars);
}
