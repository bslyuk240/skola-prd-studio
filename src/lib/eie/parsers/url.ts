import type { EieKnowledgeSource } from "@/db/schema";
import { htmlToPlainText, parseDocument, parsePdf } from "@/lib/eie/parsers/document";
import { assertPublicUrl } from "@/lib/eie/security/url-validator";
import { PDF_URL_PATTERN } from "@/lib/eie/url-patterns";

const TEXT_FILE_EXTENSIONS = [".md", ".markdown", ".txt", ".json", ".ts", ".tsx", ".js", ".jsx"];

function isTextFile(path: string): boolean {
  const lower = path.toLowerCase();
  return TEXT_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function parseGitHubRepoUrl(url: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

export async function fetchGitHubRepo(
  url: string,
  branch = "main"
): Promise<string> {
  const repo = parseGitHubRepoUrl(url);
  if (!repo) {
    throw new Error("Invalid GitHub repository URL");
  }

  const treeRes = await fetch(
    `https://api.github.com/repos/${repo.owner}/${repo.repo}/git/trees/${branch}?recursive=1`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "SkolaTech-EIE",
      },
    }
  );

  if (!treeRes.ok) {
    throw new Error(`GitHub API error: ${treeRes.status}`);
  }

  const tree = (await treeRes.json()) as {
    tree?: { path: string; type: string; url?: string }[];
  };

  const files =
    tree.tree?.filter(
      (node) =>
        node.type === "blob" &&
        isTextFile(node.path) &&
        !node.path.includes("node_modules/") &&
        !node.path.includes("dist/") &&
        !node.path.endsWith(".lock")
    ) ?? [];

  const chunks: string[] = [];
  const limit = Math.min(files.length, 40);

  for (let i = 0; i < limit; i++) {
    const file = files[i];
    const rawRes = await fetch(
      `https://api.github.com/repos/${repo.owner}/${repo.repo}/contents/${file.path}?ref=${branch}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "SkolaTech-EIE",
        },
      }
    );
    if (!rawRes.ok) continue;
    const payload = (await rawRes.json()) as { content?: string; encoding?: string };
    if (payload.encoding === "base64" && payload.content) {
      const decoded = Buffer.from(payload.content, "base64").toString("utf-8");
      chunks.push(`--- FILE: ${file.path} ---\n${decoded.slice(0, 8000)}`);
    }
  }

  if (chunks.length === 0) {
    throw new Error("No readable source files found in repository");
  }

  return chunks.join("\n\n");
}

const MAX_REDIRECTS = 3;

async function fetchRemoteBytes(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  let currentUrl = url;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    await assertPublicUrl(currentUrl);

    const res = await fetch(currentUrl, {
      headers: { "User-Agent": "SkolaTech-EIE" },
      redirect: "manual",
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        throw new Error("Redirect response missing Location header");
      }
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch remote resource: ${res.status}`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, contentType };
  }

  throw new Error("Too many redirects while fetching remote resource");
}

export async function fetchRemoteDocument(url: string): Promise<string> {
  const { buffer, contentType } = await fetchRemoteBytes(url);

  if (contentType.includes("pdf") || PDF_URL_PATTERN.test(url)) {
    return parsePdf(buffer);
  }

  if (contentType.includes("html")) {
    const text = htmlToPlainText(buffer.toString("utf-8"));
    if (text.length < 20) {
      throw new Error("Web page did not contain enough extractable text");
    }
    return text;
  }

  if (contentType.includes("text") || contentType.includes("json")) {
    return buffer.toString("utf-8");
  }

  throw new Error(`Unsupported remote content type: ${contentType || "unknown"}`);
}

export async function fetchYouTubeTranscript(url: string): Promise<string> {
  const { fetchVideoTranscript } = await import("@/lib/eie/transcription");
  return fetchVideoTranscript(url);
}

export async function extractTextFromUrl(source: EieKnowledgeSource): Promise<string> {
  if (!source.sourceUrl) {
    throw new Error("Source URL is required");
  }

  switch (source.sourceType) {
    case "github_repo":
      return fetchGitHubRepo(
        source.sourceUrl,
        (source.metadata as { branch?: string } | null)?.branch ?? "main"
      );
    case "video_url": {
      const { fetchVideoTranscript } = await import("@/lib/eie/transcription");
      return fetchVideoTranscript(source.sourceUrl);
    }
    case "pdf":
      if (PDF_URL_PATTERN.test(source.sourceUrl) || source.sourceUrl.toLowerCase().includes(".pdf")) {
        const { buffer, contentType } = await fetchRemoteBytes(source.sourceUrl);
        if (contentType.includes("pdf") || PDF_URL_PATTERN.test(source.sourceUrl)) {
          return parsePdf(buffer);
        }
      }
      return fetchRemoteDocument(source.sourceUrl);
    case "official_doc":
    case "markdown_file":
    case "research_paper":
    case "book":
      return fetchRemoteDocument(source.sourceUrl);
    default:
      throw new Error(`URL extraction not supported for type: ${source.sourceType}`);
  }
}
