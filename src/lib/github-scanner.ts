// GitHub API — read-only repo scanning

export interface FileTreeEntry {
  path: string;
  type: "blob" | "tree";
  size?: number;
}

export interface DetectedStack {
  framework: string;
  language: string;
  database: string;
  auth: string;
  ui: string;
  stateManagement: string;
  testing: string;
  deployment: string;
  packageManager: string;
  apiStyle: string;
  otherDeps: string[];
}

export interface ScanResult {
  fileTree: FileTreeEntry[];
  keyFilesContent: Record<string, string>;
  detectedStack: DetectedStack;
  modules: string[];       // detected feature areas e.g. ["Dashboard", "Auth", "Settings"]
  apiRoutes: string[];     // detected API routes
  dbSchemaFiles: string[]; // paths to schema files
  envExampleContent: string;
  error?: string;
}

// Secret patterns to redact before sending to AI
const SECRET_PATTERNS = [
  /sk[-_][a-zA-Z0-9]{20,}/g,          // Stripe/OpenAI-style keys
  /ghp_[a-zA-Z0-9]{36}/g,             // GitHub PAT
  /postgresql:\/\/[^\s"']+/g,         // DB connection strings
  /mysql:\/\/[^\s"']+/g,
  /mongodb:\/\/[^\s"']+/g,
  /AAAA[a-zA-Z0-9+/]{100,}/g,         // Firebase tokens
  /eyJ[a-zA-Z0-9._-]{50,}/g,          // JWTs
];

export function redactSecrets(content: string): string {
  let safe = content;
  for (const pattern of SECRET_PATTERNS) {
    safe = safe.replace(pattern, "[REDACTED]");
  }
  return safe;
}

function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  // Handle: https://github.com/owner/repo, github.com/owner/repo, owner/repo
  const cleaned = url.replace(/^(https?:\/\/)?(www\.)?github\.com\//, "").replace(/\.git$/, "").trim();
  const parts = cleaned.split("/");
  if (parts.length < 2) return null;
  return { owner: parts[0], repo: parts[1] };
}

async function githubFetch(url: string, token?: string) {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "SkolaTech-PRD-Studio/1.0",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.json();
}

async function getFileContent(owner: string, repo: string, path: string, branch: string, token?: string): Promise<string> {
  try {
    const data = await githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      token
    );
    if (data.encoding === "base64" && data.content) {
      return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
    }
    return "";
  } catch {
    return "";
  }
}

const KEY_FILES_TO_READ = [
  "README.md",
  "readme.md",
  "package.json",
  "tsconfig.json",
  "next.config.ts",
  "next.config.js",
  "nuxt.config.ts",
  "vite.config.ts",
  ".env.example",
  ".env.sample",
  "prisma/schema.prisma",
  "drizzle.config.ts",
  "src/db/schema.ts",
  "db/schema.ts",
  "database/schema.sql",
  "supabase/migrations",
  "tailwind.config.ts",
  "tailwind.config.js",
];

export async function scanGithubRepo(
  repoUrl: string,
  branch: string = "main",
  token?: string
): Promise<ScanResult> {
  const parsed = parseGithubUrl(repoUrl);
  if (!parsed) throw new Error("Invalid GitHub URL. Expected: github.com/owner/repo");

  const { owner, repo } = parsed;

  // 1. Get full file tree
  let treeData: { tree: FileTreeEntry[] };
  try {
    treeData = await githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      token
    );
  } catch (err) {
    // Try 'master' if 'main' fails
    if (branch === "main") {
      treeData = await githubFetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`,
        token
      );
    } else throw err;
  }

  const fileTree: FileTreeEntry[] = (treeData.tree ?? [])
    .filter((f: FileTreeEntry) => f.type === "blob")
    // Exclude node_modules, .git, dist, build, .next
    .filter((f: FileTreeEntry) => !/^(node_modules|\.git|\.next|dist|build|\.turbo|coverage)\//.test(f.path))
    .map((f: FileTreeEntry) => ({ path: f.path, type: f.type, size: f.size }));

  // 2. Read key files (predefined list)
  const keyFilesContent: Record<string, string> = {};
  await Promise.all(
    KEY_FILES_TO_READ.map(async (file) => {
      const found = fileTree.find((f) => f.path === file || f.path.endsWith("/" + file));
      if (found) {
        const content = await getFileContent(owner, repo, found.path, branch, token);
        if (content) keyFilesContent[file] = redactSecrets(content).slice(0, 3000);
      }
    })
  );

  // 2b. Also read security-sensitive API route files — these are where fixes actually live
  // Without reading these, the scanner can't detect fixes applied to individual route handlers
  const SECURITY_ROUTE_PATTERNS = [
    /\/(webhook|webhooks)\//i,
    /\/(upload|file-upload|logo|avatar|image)\//i,
    /\/(auth|login|signin|signup|register|password-reset)\//i,
    /\/admin\//i,
    /\/(download|export|documents)\//i,
    /\/(attendance|staff|users)\//i,
    /middleware\.(ts|js)$/i,
    /rate.?limit/i,
  ];

  const securityRouteFiles = fileTree
    .filter((f) =>
      f.path.match(/\.(ts|js|tsx|jsx)$/) &&
      SECURITY_ROUTE_PATTERNS.some((p) => p.test(f.path)) &&
      !f.path.includes("node_modules") &&
      (f.size ?? 0) < 50000 // skip huge files
    )
    .slice(0, 25); // cap at 25 to avoid rate limits

  await Promise.all(
    securityRouteFiles.map(async (f) => {
      if (keyFilesContent[f.path]) return; // already read
      const content = await getFileContent(owner, repo, f.path, branch, token);
      if (content) keyFilesContent[f.path] = redactSecrets(content).slice(0, 4000);
    })
  );

  // 3. Detect stack from package.json
  const detectedStack = detectStack(keyFilesContent["package.json"] ?? "", fileTree);

  // 4. Detect modules from folder structure
  const modules = detectModules(fileTree);

  // 5. Detect API routes
  const apiRoutes = fileTree
    .filter((f) => f.path.match(/\/(api|routes)\/.*\.(ts|js)$/))
    .map((f) => f.path)
    .slice(0, 50);

  // 6. Find schema files
  const dbSchemaFiles = fileTree
    .filter((f) => /schema\.(ts|js|sql|prisma)|migration|migrate/.test(f.path))
    .map((f) => f.path);

  // 7. Env example
  const envExampleContent = redactSecrets(
    keyFilesContent[".env.example"] ?? keyFilesContent[".env.sample"] ?? ""
  );

  return {
    fileTree: fileTree.slice(0, 500), // cap at 500 entries
    keyFilesContent,
    detectedStack,
    modules,
    apiRoutes,
    dbSchemaFiles,
    envExampleContent,
  };
}

function detectStack(packageJsonStr: string, fileTree: FileTreeEntry[]): DetectedStack {
  let pkg: Record<string, Record<string, string>> = {};
  try {
    pkg = JSON.parse(packageJsonStr);
  } catch {}

  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const paths = fileTree.map((f) => f.path).join(" ");

  function has(...names: string[]) {
    return names.some((n) => deps[n] !== undefined);
  }
  function pathHas(pattern: string) {
    return paths.includes(pattern);
  }

  // Framework
  let framework = "Unknown";
  if (has("next")) framework = `Next.js ${deps["next"]?.replace(/[\^~]/, "") ?? ""}`.trim();
  else if (has("nuxt", "nuxt3")) framework = "Nuxt.js";
  else if (has("@remix-run/react")) framework = "Remix";
  else if (has("gatsby")) framework = "Gatsby";
  else if (has("vite") && has("react")) framework = "React + Vite";
  else if (has("@sveltejs/kit")) framework = "SvelteKit";
  else if (has("astro")) framework = "Astro";
  else if (has("express")) framework = "Express.js";
  else if (has("fastify")) framework = "Fastify";
  else if (has("hono")) framework = "Hono";
  else if (has("@nestjs/core")) framework = "NestJS";
  else if (has("django")) framework = "Django";
  else if (has("fastapi")) framework = "FastAPI";

  // Language
  let language = "JavaScript";
  if (has("typescript") || pathHas("tsconfig")) language = "TypeScript";
  if (pathHas(".py")) language = "Python";

  // Database
  let database = "Not detected";
  if (has("@neondatabase/serverless")) database = "PostgreSQL (Neon)";
  else if (has("@supabase/supabase-js")) database = "PostgreSQL (Supabase)";
  else if (has("prisma", "@prisma/client")) database = `PostgreSQL/MySQL (Prisma)`;
  else if (has("drizzle-orm")) database = "PostgreSQL (Drizzle)";
  else if (has("mongoose")) database = "MongoDB";
  else if (has("mysql2")) database = "MySQL";
  else if (has("better-sqlite3", "sqlite3")) database = "SQLite";
  else if (has("@planetscale/database")) database = "MySQL (PlanetScale)";
  else if (pathHas("supabase")) database = "PostgreSQL (Supabase)";

  // Auth
  let auth = "Not detected";
  if (has("@clerk/nextjs", "@clerk/clerk-react", "@clerk/clerk-sdk-node")) auth = "Clerk";
  else if (has("next-auth", "@auth/core")) auth = "NextAuth.js / Auth.js";
  else if (has("@supabase/auth-helpers-nextjs") || pathHas("supabase/auth")) auth = "Supabase Auth";
  else if (has("firebase", "@firebase/auth")) auth = "Firebase Auth";
  else if (has("passport")) auth = "Passport.js";
  else if (has("jsonwebtoken", "jose")) auth = "Custom JWT";
  else if (has("@auth0/nextjs-auth0")) auth = "Auth0";
  else if (has("lucia")) auth = "Lucia Auth";

  // UI
  let ui = "Not detected";
  if (has("shadcn")) ui = "shadcn/ui";
  else if (has("@radix-ui/react-dialog") || pathHas("@radix-ui")) ui = "Radix UI";
  else if (has("@mui/material")) ui = "Material UI";
  else if (has("antd")) ui = "Ant Design";
  else if (has("@chakra-ui/react")) ui = "Chakra UI";
  else if (has("daisyui")) ui = "DaisyUI";
  else if (has("react-bootstrap")) ui = "React Bootstrap";
  else if (has("tailwindcss")) ui = "Tailwind CSS (custom)";

  // State
  let stateManagement = "Not detected";
  if (has("zustand")) stateManagement = "Zustand";
  else if (has("jotai")) stateManagement = "Jotai";
  else if (has("@reduxjs/toolkit", "redux")) stateManagement = "Redux Toolkit";
  else if (has("recoil")) stateManagement = "Recoil";
  else if (has("@tanstack/react-query", "react-query")) stateManagement = "TanStack Query";
  else if (has("swr")) stateManagement = "SWR";
  else if (framework.startsWith("Next")) stateManagement = "React state / server components";

  // Testing
  let testing = "None detected";
  if (has("vitest")) testing = "Vitest";
  else if (has("jest")) testing = "Jest";
  else if (has("@playwright/test")) testing = "Playwright";
  else if (has("cypress")) testing = "Cypress";

  // Deployment
  let deployment = "Not detected";
  if (pathHas("vercel.json") || pathHas(".vercel")) deployment = "Vercel";
  else if (pathHas("netlify.toml")) deployment = "Netlify";
  else if (pathHas("railway.json") || pathHas("railway.toml")) deployment = "Railway";
  else if (pathHas("Dockerfile")) deployment = "Docker";
  else if (pathHas("fly.toml")) deployment = "Fly.io";
  else if (pathHas(".github/workflows")) deployment = "GitHub Actions CI/CD";

  // Package manager
  let packageManager = "npm";
  if (pathHas("pnpm-lock") || pathHas("pnpm-workspace")) packageManager = "pnpm";
  else if (pathHas("yarn.lock")) packageManager = "Yarn";
  else if (pathHas("bun.lockb")) packageManager = "Bun";

  // API style
  let apiStyle = "REST";
  if (has("graphql", "@apollo/server", "graphql-yoga")) apiStyle = "GraphQL";
  else if (has("@trpc/server")) apiStyle = "tRPC";

  // Other notable deps
  const notableDeps = ["stripe", "resend", "nodemailer", "uploadthing", "aws-sdk", "openai", "langchain", "zod", "react-hook-form", "react-email"];
  const otherDeps = notableDeps.filter((d) => has(d));

  return { framework, language, database, auth, ui, stateManagement, testing, deployment, packageManager, apiStyle, otherDeps };
}

function detectModules(fileTree: FileTreeEntry[]): string[] {
  // Look at top-level app/ or pages/ directories
  const appPaths = fileTree
    .filter((f) => f.path.match(/^(src\/app|app|src\/pages|pages)\/[^/]+\//))
    .map((f) => {
      const parts = f.path.split("/");
      const appIdx = parts.findIndex((p) => p === "app" || p === "pages");
      return appIdx >= 0 ? parts[appIdx + 1] : null;
    })
    .filter(Boolean) as string[];

  const unique = [...new Set(appPaths)]
    .filter((p) => !p.startsWith("(") && !p.startsWith("[") && !p.startsWith("_") && !p.includes("."))
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).replace(/-/g, " "));

  return unique.slice(0, 20);
}

export { parseGithubUrl };
