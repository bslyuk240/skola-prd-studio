/** Parse markdown and plain text sources into normalized text for extraction. */

export function parsePlainText(content: string): string {
  return content.replace(/\r\n/g, "\n").trim();
}

export function parseMarkdown(content: string): string {
  const normalized = parsePlainText(content);
  // Preserve heading hierarchy as plain-text section markers for the LLM.
  return normalized.replace(/^(#{1,6})\s+(.+)$/gm, (_, hashes: string, title: string) => {
    const level = hashes.length;
    return `${"#".repeat(level)} ${title}`;
  });
}

export async function parsePdf(_buffer: Buffer): Promise<string> {
  // PDF parsing requires a dedicated library (e.g. pdf-parse) in a later iteration.
  throw new Error("PDF parsing is not yet configured. Install a PDF parser dependency.");
}

export async function parseDocument(
  content: string | Buffer,
  sourceType: "pdf" | "markdown_file" | "personal_note" | "book" | "research_paper"
): Promise<string> {
  if (sourceType === "pdf") {
    if (!Buffer.isBuffer(content)) {
      throw new Error("PDF content must be provided as a Buffer");
    }
    return parsePdf(content);
  }

  const text = Buffer.isBuffer(content) ? content.toString("utf-8") : content;
  if (sourceType === "markdown_file") {
    return parseMarkdown(text);
  }
  return parsePlainText(text);
}
