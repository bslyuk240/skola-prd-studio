/** Parse markdown and plain text sources into normalized text for extraction. */

export function parsePlainText(content: string): string {
  return content.replace(/\r\n/g, "\n").trim();
}

export function parseMarkdown(content: string): string {
  const normalized = parsePlainText(content);
  return normalized.replace(/^(#{1,6})\s+(.+)$/gm, (_, hashes: string, title: string) => {
    const level = hashes.length;
    return `${"#".repeat(level)} ${title}`;
  });
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function parsePdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const text = result.text?.trim();
    if (!text || text.length < 20) {
      throw new Error("PDF did not contain enough extractable text");
    }
    return text;
  } finally {
    await parser.destroy();
  }
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
