import type { EieKnowledgeSource } from "@/db/schema";
import { assertPublicUrl } from "@/lib/eie/security/url-validator";

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

export async function fetchRemoteDocument(url: string): Promise<string> {
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
      throw new Error(`Failed to fetch document: ${res.status}`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("text") || contentType.includes("json")) {
      return res.text();
    }
    throw new Error(`Unsupported remote content type: ${contentType}`);
  }

  throw new Error("Too many redirects while fetching remote document");
}

/** Placeholder for caption/transcript extraction — wired in Phase 5 async pipeline. */
export async function fetchYouTubeTranscript(_url: string): Promise<string> {
  throw new Error(
    "Video transcription is not yet configured. Connect Whisper or a caption provider."
  );
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
    case "video_url":
      return fetchYouTubeTranscript(source.sourceUrl);
    case "official_doc":
    case "markdown_file":
    case "research_paper":
      return fetchRemoteDocument(source.sourceUrl);
    default:
      throw new Error(`URL extraction not supported for type: ${source.sourceType}`);
  }
}
