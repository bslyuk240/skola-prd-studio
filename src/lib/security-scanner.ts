import type { DetectedStack } from "./github-scanner";

export type ConfidenceLevel = "confirmed" | "likely_gap" | "needs_review" | "recommended";
export type SeverityLevel = "critical" | "high" | "medium" | "low" | "info";

export interface SecurityFinding {
  pack: string;
  title: string;
  description: string;
  confidence: ConfidenceLevel;
  severity: SeverityLevel;
  affectedFiles?: string[];
  recommendation: string;
  codeEvidence?: string;
}

export interface SecurityPack {
  id: string;
  name: string;
  appliesWhen: (stack: DetectedStack, paths: string[], content: Record<string, string>) => boolean;
  checks: SecurityCheck[];
}

export interface SecurityCheck {
  title: string;
  severity: SeverityLevel;
  detect: (stack: DetectedStack, paths: string[], content: Record<string, string>) => DetectionResult | null;
}

export interface DetectionResult {
  confidence: ConfidenceLevel;
  description: string;
  affectedFiles?: string[];
  evidence?: string;
  recommendation: string;
}

// ─── Context helpers ──────────────────────────────────────────────────────────

function pathsContain(paths: string[], ...patterns: string[]) {
  return patterns.some((p) => paths.some((f) => f.toLowerCase().includes(p.toLowerCase())));
}

function contentContains(content: Record<string, string>, pattern: RegExp | string): { file: string; match: string } | null {
  for (const [file, text] of Object.entries(content)) {
    if (typeof pattern === "string") {
      if (text.includes(pattern)) return { file, match: pattern };
    } else {
      const m = text.match(pattern);
      if (m) return { file, match: m[0] };
    }
  }
  return null;
}

// Does the detected auth provider handle this concern natively?
// Clerk, Firebase Auth, Supabase Auth, Auth0 etc all handle:
// - Password hashing
// - Account lockout
// - Password reset token security
// - Session management
function authIsDelegated(stack: DetectedStack): boolean {
  const delegatedProviders = [
    "clerk", "firebase", "supabase auth", "auth0", "nextauth", "auth.js",
    "kinde", "lucia", "better-auth",
  ];
  return delegatedProviders.some((p) => stack.auth.toLowerCase().includes(p));
}

// Is the deployment serverless (Netlify/Vercel/Fly)?
// In-memory stores don't survive function restarts on these platforms.
function isServerless(stack: DetectedStack, paths: string[]): boolean {
  return (
    stack.deployment.toLowerCase().includes("netlify") ||
    stack.deployment.toLowerCase().includes("vercel") ||
    stack.deployment.toLowerCase().includes("fly") ||
    pathsContain(paths, "netlify.toml", "vercel.json", ".vercel", "fly.toml")
  );
}

// Does the file import from a security/auth/validation lib?
// Credit security patterns even when custom function names are used.
function importsSecurityLib(fileContent: string): boolean {
  return /from ['"][@\w]*(security|auth|validate|validator|file.?valid|rate.?limit|ratelimit|webhook|signature|verify)['"]/i.test(fileContent) ||
    /require\(['"][@\w]*(security|auth|validate|webhook|signature|verify)['"]\)/i.test(fileContent);
}

function findAuthRouteFiles(paths: string[]): string[] {
  return paths.filter((p) =>
    /\/(login|sign-in|signin|auth|register|signup|sign-up|password-reset|forgot-password)/i.test(p) &&
    /\.(ts|js|tsx|jsx|py|rb)$/.test(p)
  );
}

function findApiRouteFiles(paths: string[]): string[] {
  return paths.filter((p) =>
    /\/(api|routes|controllers)\//i.test(p) && /\.(ts|js|tsx|jsx|py|rb)$/.test(p)
  );
}

// ─── Packs ────────────────────────────────────────────────────────────────────

const BASELINE_PACK: SecurityPack = {
  id: "baseline",
  name: "Baseline Web Security",
  appliesWhen: () => true,
  checks: [
    {
      title: ".env file committed to repository",
      severity: "critical",
      detect(_, paths) {
        const found = paths.filter((p) =>
          /^\.env$|^\.env\.(local|prod|production|staging|dev|development)$/.test(p)
        );
        if (found.length > 0) return {
          confidence: "confirmed",
          description: `Found .env files tracked in the repository: ${found.join(", ")}. These may contain secrets that are now exposed.`,
          affectedFiles: found,
          evidence: found.join(", "),
          recommendation: "Immediately revoke all secrets in these files. Add all .env variants to .gitignore. Rotate all API keys, tokens, and passwords.",
        };
        return null;
      },
    },
    {
      title: "Hardcoded secrets or API keys in source files",
      severity: "critical",
      detect(_, paths, content) {
        const secretPatterns = [
          /sk[-_][a-zA-Z0-9]{20,}/,
          /ghp_[a-zA-Z0-9]{36}/,
          /AAAA[a-zA-Z0-9+/]{50,}/,
          /AIza[0-9A-Za-z-_]{35}/,
          /(?:password|secret|api_key)\s*=\s*['"][^'"]{8,}['"]/i,
        ];
        for (const pattern of secretPatterns) {
          const found = contentContains(content, pattern);
          if (found) return {
            confidence: "confirmed",
            description: `Potential hardcoded secret found in ${found.file}: "${found.match.slice(0, 30)}…"`,
            affectedFiles: [found.file],
            evidence: found.match.slice(0, 50),
            recommendation: "Move all secrets to environment variables immediately. Rotate the exposed credential.",
          };
        }
        return null;
      },
    },
    {
      title: "Security headers not configured",
      severity: "high",
      detect(stack, paths, content) {
        const hasNextConfig = pathsContain(paths, "next.config");
        const hasSecurityHeaders = contentContains(content, /Content-Security-Policy|X-Frame-Options|Strict-Transport-Security|X-Content-Type-Options/);
        if (hasNextConfig && !hasSecurityHeaders) return {
          confidence: "likely_gap",
          description: "No HTTP security headers detected in the Next.js config.",
          affectedFiles: paths.filter((p) => p.includes("next.config")),
          recommendation: "Add a `headers()` function to next.config.ts with CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, HSTS, and Referrer-Policy.",
        };
        return null;
      },
    },
    {
      title: "Dependency security — no lockfile present",
      severity: "medium",
      detect(_, paths) {
        const hasLock = pathsContain(paths, "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb");
        if (!hasLock) return {
          confidence: "confirmed",
          description: "No lockfile found. Dependency versions are not pinned, making supply chain attacks easier.",
          recommendation: "Commit package-lock.json (or equivalent lockfile) to the repository.",
        };
        return null;
      },
    },
    {
      title: "Debug mode or verbose error logging",
      severity: "medium",
      detect(_, paths, content) {
        const found = contentContains(content, /console\.log.*password|console\.log.*token|console\.log.*secret/i);
        if (found) return {
          confidence: "confirmed",
          description: `Sensitive data may be logged in ${found.file}.`,
          evidence: found.match,
          recommendation: "Remove or guard all console.log statements that could expose sensitive data in production.",
        };
        return null;
      },
    },
    {
      title: "Google ID token not verified server-side",
      severity: "critical",
      detect(_, paths, content) {
        // Only applies if Google OAuth is used
        const usesGoogle = contentContains(content, /google|firebase/i) &&
          pathsContain(paths, "auth", "google", "oauth");
        if (!usesGoogle) return null;

        // Look for credential/id_token being decoded without server-side verification
        const decodeWithoutVerify = contentContains(content, /credential\.split\('\.'|id_token\.split\('\.'|atob\(base64\)|base64Url\.replace/);
        if (decodeWithoutVerify) {
          // Check if server-side verification is also present
          const hasVerification = contentContains(content, /tokeninfo\?id_token|google.*verify|verifyIdToken|OAuth2Client|GoogleAuth|google-auth-library|jwks|x509/i);
          if (!hasVerification) return {
            confidence: "confirmed",
            description: `Google ID token is decoded (base64 split) without cryptographic server-side verification in ${decodeWithoutVerify.file}. An attacker can forge any Google identity by crafting a fake JWT payload.`,
            affectedFiles: [decodeWithoutVerify.file],
            evidence: decodeWithoutVerify.match,
            recommendation: "Verify the Google credential server-side using Google's tokeninfo endpoint (https://oauth2.googleapis.com/tokeninfo?id_token=TOKEN) or the google-auth-library. Never trust client-side GSI verification alone.",
          };
        }
        return null;
      },
    },
  ],
};

const AUTH_PACK: SecurityPack = {
  id: "authentication",
  name: "Authentication Security",
  appliesWhen: (stack) => stack.auth !== "Not detected",
  checks: [
    {
      title: "Rate limiting on authentication routes",
      severity: "high",
      detect(stack, paths, content) {
        const authFiles = findAuthRouteFiles(paths);
        if (authFiles.length === 0) return null;

        // Patterns covering standard libs AND custom implementations
        const rateLimitPatterns = /rateLimit|rate-limit|rate_limit|Ratelimit|upstash|redis.*limit|limiter|throttle|RateLimiter|slidingWindow|fixedWindow/i;
        const hasRateLimit = contentContains(content, rateLimitPatterns);

        // Also credit if middleware covers auth routes
        const middlewareContent = content["middleware.ts"] ?? content["src/middleware.ts"] ?? "";
        const middlewareCoversAuth = /api\/auth|\/login|\/signin|\/signup/i.test(middlewareContent) &&
          rateLimitPatterns.test(middlewareContent);

        if (!hasRateLimit && !middlewareCoversAuth) return {
          confidence: "likely_gap",
          description: "No rate limiting detected on authentication routes. Without rate limiting, attackers can attempt unlimited credential guesses or flood signup/reset endpoints.",
          affectedFiles: authFiles,
          recommendation: "Add rate limiting to login, signup, and password reset routes. Use Upstash Redis (@upstash/ratelimit) for serverless-safe rate limiting that persists across instances.",
        };

        // Rate limiter exists — but is it an in-memory Map on serverless?
        if (isServerless(stack, paths)) {
          const inMemoryLimiter = contentContains(content, /new Map<|rateLimitStore\s*=\s*new Map|= new Map\(\)/);
          if (inMemoryLimiter) return {
            confidence: "confirmed",
            description: `Rate limiter uses an in-memory Map (found in ${inMemoryLimiter.file}). On serverless platforms (Netlify/Vercel), each function instance has its own memory — the store resets on every cold start and provides no real protection across concurrent instances.`,
            affectedFiles: [inMemoryLimiter.file],
            evidence: inMemoryLimiter.match,
            recommendation: "Replace the in-memory Map with Upstash Redis (@upstash/ratelimit). Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to your environment variables.",
          };
        }

        return null;
      },
    },
    {
      title: "Account lockout after failed login attempts",
      severity: "high",
      detect(stack, paths, content) {
        // Skip if auth is fully delegated — provider handles this
        if (authIsDelegated(stack)) return null;

        // Skip if no password-based login exists
        const hasPasswordLogin = pathsContain(paths, "login", "signin", "classic-login") &&
          contentContains(content, /password/i);
        if (!hasPasswordLogin) return null;

        const hasLockout = contentContains(content, /lockout|lock.?account|failed.?attempts|maxAttempts|tooManyRequests|MAX_FAILED|incr.*lock|lock.*incr/i);
        if (!hasLockout) return {
          confidence: "likely_gap",
          description: "No account lockout logic detected for password-based login. Attackers rotating IPs can bypass rate limiting and brute-force individual accounts indefinitely.",
          recommendation: "Track failed attempts per email in Redis or DB. After 5 failures, lock the account for 15 minutes. Use Upstash Redis for serverless-safe persistence.",
        };
        return null;
      },
    },
    {
      title: "Unsafe authentication error messages",
      severity: "high",
      detect(_, paths, content) {
        const badMessages = [
          "user not found", "email not found", "account does not exist",
          "wrong password", "incorrect password", "password is wrong",
          "invalid password", "no account",
        ];
        for (const msg of badMessages) {
          const found = contentContains(content, msg.toLowerCase());
          if (found) return {
            confidence: "confirmed",
            description: `Unsafe error message found in ${found.file}: "${found.match}". This reveals whether an email exists, enabling account enumeration.`,
            affectedFiles: [found.file],
            evidence: found.match,
            recommendation: 'Use only: "Incorrect email or password." for login failures. For password reset: "If that email is registered, you\'ll receive a reset link."',
          };
        }
        return null;
      },
    },
    {
      title: "Password hashing — weak or missing",
      severity: "critical",
      detect(stack, paths, content) {
        // Auth provider handles this — not our concern
        if (authIsDelegated(stack)) return null;

        const hasMd5 = contentContains(content, /md5|sha1|sha-1|createHash.*md5|createHash.*sha1/i);
        if (hasMd5) return {
          confidence: "confirmed",
          description: "Weak password hashing detected (MD5 or SHA-1). These are cryptographically broken and trivially reversed.",
          evidence: hasMd5.match,
          recommendation: "Replace immediately with bcrypt (cost factor 12+) or Argon2id.",
        };

        const hasHashing = contentContains(content, /bcrypt|argon2|pbkdf2|scrypt/i);
        if (!hasHashing) {
          const authFiles = findAuthRouteFiles(paths);
          if (authFiles.length > 0) return {
            confidence: "needs_review",
            description: "No password hashing library detected. Verify that auth is fully delegated to a provider, or that bcrypt/Argon2id is used.",
            affectedFiles: authFiles,
            recommendation: "If handling passwords directly, use bcrypt or Argon2id. If using Supabase/Clerk/Firebase Auth, verify all auth flows go through the provider.",
          };
        }
        return null;
      },
    },
    {
      title: "Password reset token security",
      severity: "high",
      detect(stack, paths, content) {
        // Delegated auth handles reset — skip
        if (authIsDelegated(stack)) return null;

        const hasReset = pathsContain(paths, "password-reset", "forgot-password", "reset-password");
        if (!hasReset) return null;

        const hasExpiry = contentContains(content, /expires|expiry|expiresAt|ttl|maxAge|expires_at/i);
        if (!hasExpiry) return {
          confidence: "likely_gap",
          description: "Password reset routes detected but no token expiry logic found. Reset tokens that never expire allow indefinite account takeover.",
          recommendation: "Set reset tokens to expire after 15-60 minutes. Invalidate immediately after first use. Use crypto.randomBytes(32) for token generation.",
        };
        return null;
      },
    },
  ],
};

const API_SECURITY_PACK: SecurityPack = {
  id: "api_security",
  name: "API Security",
  appliesWhen: (_, paths) => findApiRouteFiles(paths).length > 0,
  checks: [
    {
      title: "Server-side input validation",
      severity: "critical",
      detect(_, paths, content) {
        const apiFiles = findApiRouteFiles(paths);
        if (apiFiles.length === 0) return null;

        // Credit custom validation libs (importsSecurityLib checks for validate/validator imports)
        const hasValidation = contentContains(content, /zod|joi|yup|ajv|pydantic|express-validator|class-validator|safeParse|validate\(/i) ||
          Object.values(content).some(importsSecurityLib);

        if (!hasValidation) return {
          confidence: "likely_gap",
          description: "No input validation library detected in API routes.",
          affectedFiles: apiFiles.slice(0, 5),
          recommendation: "Add Zod or equivalent to validate all API request bodies, query params, and path params server-side.",
        };
        return null;
      },
    },
    {
      title: "CORS wildcard configuration",
      severity: "high",
      detect(_, paths, content) {
        const hasWildcard = contentContains(content, /Access-Control-Allow-Origin.*\*|cors\(\{\s*origin:\s*['"`]\*['"`]/i);
        if (!hasWildcard) return null;

        // Check if the wildcard is guarded by a dev-only condition.
        // Pattern: if (!isProd) { ... * ... } or NODE_ENV !== 'production'
        const fileContent = content[hasWildcard.file] ?? "";
        const wildcardLine = fileContent.indexOf(hasWildcard.match);
        const surrounding = fileContent.slice(Math.max(0, wildcardLine - 200), wildcardLine + 50);
        const isDevOnly = /!isProd|NODE_ENV.*!==.*production|NODE_ENV.*===.*development|isDev|if.*dev/i.test(surrounding);

        if (isDevOnly) return {
          confidence: "needs_review",
          description: `CORS wildcard (*) found in ${hasWildcard.file} but appears to be inside a dev-only condition. Verify that production deployments never send Access-Control-Allow-Origin: * for real requests.`,
          evidence: hasWildcard.match,
          recommendation: "Confirm NODE_ENV=production is set on your hosting platform. Consider extracting dev/prod CORS into separate configs to make the intent clearer.",
        };

        return {
          confidence: "confirmed",
          description: `Wildcard CORS (*) in ${hasWildcard.file} with no environment guard. Any website can make credentialed requests to your API.`,
          evidence: hasWildcard.match,
          recommendation: "Restrict CORS to specific origins. Use an allowlist driven by ALLOWED_ORIGINS env var. Never use * in production.",
        };
      },
    },
    {
      title: "SQL injection risk — raw string interpolation in queries",
      severity: "critical",
      detect(_, paths, content) {
        const rawQuery = contentContains(content, /query\(`.*\${|execute\(`.*\${|raw\(`.*\${|\.query\(.*\+.*req\./i);
        if (rawQuery) return {
          confidence: "confirmed",
          description: `Raw SQL query with string interpolation in ${rawQuery.file}. SQL injection vulnerability.`,
          evidence: rawQuery.match,
          recommendation: "Use parameterised queries or an ORM only. Never interpolate user input into SQL strings.",
        };
        return null;
      },
    },
    {
      title: "Sensitive API routes without authentication check",
      severity: "critical",
      detect(_, paths, content) {
        const sensitiveRoutes = findApiRouteFiles(paths).filter((p) =>
          /\/(user|profile|admin|settings|data|export|delete|update)/i.test(p)
        );
        if (sensitiveRoutes.length === 0) return null;

        // Credit any auth pattern including custom ones
        const authPatterns = /auth\(\)|getAuth|requireAuth|authenticate|currentUser|userId|session|jwt\.verify|Bearer|getServerSession|requireSession|getUser|verifyToken|checkAuth|withAuth/;
        const unprotected = sensitiveRoutes.filter((route) => {
          const fc = content[route] ?? "";
          // Also credit if the file imports from an auth lib
          return fc.length > 0 && !authPatterns.test(fc) && !importsSecurityLib(fc);
        });

        if (unprotected.length > 0) return {
          confidence: "likely_gap",
          description: `${unprotected.length} sensitive API route(s) may lack authentication: ${unprotected.slice(0, 3).join(", ")}`,
          affectedFiles: unprotected,
          recommendation: "Every API route that reads or writes user data must verify authentication server-side.",
        };
        return null;
      },
    },
    {
      title: "Webhook signature verification",
      severity: "high",
      detect(_, paths, content) {
        // Only flag if there are actual webhook ROUTE HANDLER files — not just
        // field references like `webhook_url` in data models or admin routes.
        const webhookRouteFiles = paths.filter((p) =>
          /\/(webhook|webhooks)\/.*\.(ts|js)|\/webhook\.(ts|js)|webhooks\.(ts|js)/i.test(p)
        );
        if (webhookRouteFiles.length === 0) return null;

        // Broad pattern — covers standard libs and custom implementations
        const hasSigCheck = contentContains(content,
          /svix|stripe\.webhooks\.constructEvent|verifyWebhook|webhook.?secret|webhook_secret|WEBHOOK_SECRET|wh\.verify|Webhook\.verify|svix-signature|verifySignature|computeHmac|createHmac.*webhook|verifyPaystackSignature|verifyResendWebhook|verifyStripeWebhook|verifyClerkWebhook|x-paystack-signature|x-hub-signature|signature.*verification|verif.*signature|constructEvent|rawBody.*signature|signature.*rawBody/i
        );

        // Also credit if webhook files import from a security lib
        const webhookFiles = Object.entries(content).filter(([p]) => /webhook/i.test(p));
        const webhookImportsSecurityLib = webhookFiles.some(([, fc]) => importsSecurityLib(fc));

        if (!hasSigCheck && !webhookImportsSecurityLib) return {
          confidence: "likely_gap",
          description: "Webhook routes detected but no signature verification found. Unverified webhooks allow attackers to forge requests.",
          recommendation: "Always verify webhook signatures using the provider's SDK before processing any payload. Read the raw body BEFORE parsing JSON.",
        };
        return null;
      },
    },
  ],
};

const RBAC_PACK: SecurityPack = {
  id: "rbac",
  name: "Role-Based Access Control",
  appliesWhen: (_, paths, content) =>
    /role|permission|admin|staff|manager/i.test(Object.keys(content).join(" ") + paths.join(" ")),
  checks: [
    {
      title: "Admin routes without server-side role verification",
      severity: "critical",
      detect(_, paths, content) {
        const adminRoutes = paths.filter((p) => /\/admin\//i.test(p));
        if (adminRoutes.length === 0) return null;

        // Next.js App Router: layout.tsx is the correct place for route-level auth.
        // Check layout files first — they protect all child routes.
        const adminLayouts = paths.filter((p) =>
          /\/admin\/layout\.(ts|tsx|js)|\/admin.*\/layout\.(ts|tsx|js)/i.test(p)
        );
        const layoutHasAuth = adminLayouts.some((layoutPath) => {
          const fc = content[layoutPath] ?? "";
          return /requireSession|requireDepartmentRouteAccess|getServerSession|auth\.protect|checkRole|requireRole|verifyRole|getUser|hasRole|isAdmin|role.*admin|admin.*role|withAuth|verifyAuth/i.test(fc) ||
            importsSecurityLib(fc);
        });
        if (layoutHasAuth) return null;

        // Check if any admin route/middleware has auth
        const hasAnyAdminAuth = Object.entries(content).some(([path, fc]) =>
          /\/admin\//i.test(path) &&
          (/requireSession|getServerSession|auth\.protect|checkRole|requireRole|isAdmin|hasRole|verifyRole|withAuth/i.test(fc) || importsSecurityLib(fc))
        );
        if (hasAnyAdminAuth) return null;

        const unprotected = adminRoutes.filter((route) => {
          const fc = content[route] ?? "";
          return fc.length > 0 && !/requireSession|getServerSession|auth|checkRole|requireRole|isAdmin|hasRole/i.test(fc) && !importsSecurityLib(fc);
        });

        if (unprotected.length > 0) return {
          confidence: "likely_gap",
          description: `Admin routes may lack role verification: ${unprotected.slice(0, 3).join(", ")}. In Next.js App Router, use layout.tsx for route-level protection.`,
          affectedFiles: unprotected,
          recommendation: "In Next.js App Router, add server-side session and role checks to admin layout.tsx — this protects all child routes without repeating the check on every page.",
        };
        return null;
      },
    },
    {
      title: "Object-level authorization (IDOR/BOLA)",
      severity: "critical",
      detect(_, paths) {
        const dataRoutes = findApiRouteFiles(paths);
        if (dataRoutes.length === 0) return null;
        return {
          confidence: "needs_review",
          description: "Object-level authorization cannot be verified from code structure alone. This is one of the most common exploited flaws — users accessing records that belong to other users by changing an ID.",
          affectedFiles: dataRoutes.slice(0, 5),
          recommendation: "Manually verify: every DB query that retrieves a record by ID must also filter by the authenticated user's ID or permitted scope. Never trust client-supplied IDs alone.",
        };
      },
    },
    {
      title: "User role stored client-side",
      severity: "high",
      detect(_, paths, content) {
        const clientRoleStorage = contentContains(content, /localStorage.*role|sessionStorage.*role|cookie.*role.*=|role.*localStorage/i);
        if (clientRoleStorage) return {
          confidence: "confirmed",
          description: `User role stored in localStorage/sessionStorage in ${clientRoleStorage.file}. Client-side role storage can be tampered with.`,
          evidence: clientRoleStorage.match,
          recommendation: "Never use client-side storage for roles that affect authorization. Verify roles server-side on every request from a trusted source.",
        };
        return null;
      },
    },
  ],
};

const DATABASE_PACK: SecurityPack = {
  id: "database",
  name: "Database Security",
  appliesWhen: (stack) => stack.database !== "Not detected",
  checks: [
    {
      title: "Row Level Security (RLS) policies — Supabase",
      severity: "critical",
      detect(stack, paths, content) {
        const isSupabase = stack.database.toLowerCase().includes("supabase") ||
          contentContains(content, /supabase/i) !== null;
        if (!isSupabase) return null;

        const hasRLS = contentContains(content, /enable row level security|create policy|RLS|row.?level|auth\.uid\(\)/i);
        const hasMigrations = pathsContain(paths, "migration", "migrations", "supabase");
        if (!hasRLS && !hasMigrations) return {
          confidence: "likely_gap",
          description: "Supabase detected but no RLS policies found. Without RLS, any authenticated user can query any row.",
          recommendation: "Enable RLS on every table. Add explicit policies using auth.uid() = user_id for data isolation.",
        };
        return null;
      },
    },
    {
      title: "Supabase service role key used client-side",
      severity: "critical",
      detect(_, paths, content) {
        const serviceKey = contentContains(content, /SUPABASE_SERVICE_ROLE|service_role/i);
        if (!serviceKey) return null;

        // Flag if it's in a client-accessible file
        const isClient = /components\/|store\/|context\/|hooks\/|pages\/(?!api)/.test(serviceKey.file);
        if (isClient) return {
          confidence: "confirmed",
          description: `Supabase service role key used in client-accessible file: ${serviceKey.file}. The service role bypasses ALL RLS policies.`,
          evidence: serviceKey.match,
          recommendation: "The service role key must only be used in server-side files (API routes, server actions). Rotate it immediately if exposed client-side.",
        };
        return {
          confidence: "needs_review",
          description: "Supabase service role key usage detected. Verify it is only in server-side files and never compiled into client bundles.",
          recommendation: "Search your codebase: confirm SUPABASE_SERVICE_ROLE_KEY is never in components/, store/, or context/ directories.",
        };
      },
    },
    {
      title: "Database connection string exposed in code",
      severity: "critical",
      detect(_, paths, content) {
        const connString = contentContains(content, /postgresql:\/\/[^'"\\s]{10,}|mysql:\/\/[^'"\\s]{10,}|mongodb\+srv:\/\//i);
        if (connString && !connString.file.includes(".env") && !connString.file.includes("example")) return {
          confidence: "confirmed",
          description: `Database connection string in ${connString.file}. Full credentials exposed.`,
          evidence: connString.match.slice(0, 40) + "…",
          recommendation: "Move DATABASE_URL to environment variables. Rotate the database password.",
        };
        return null;
      },
    },
  ],
};

const EXPORT_PACK: SecurityPack = {
  id: "export_security",
  name: "Export Security",
  appliesWhen: (_, paths) => pathsContain(paths, "export", "download", "csv", "pdf"),
  checks: [
    {
      title: "Export routes without authentication",
      severity: "high",
      detect(_, paths, content) {
        const exportRoutes = paths.filter((p) =>
          /\/(export|download|csv|pdf|report)/i.test(p) && /\.(ts|js)$/.test(p)
        );
        if (exportRoutes.length === 0) return null;

        const unprotected = exportRoutes.filter((r) => {
          const fc = content[r] ?? "";
          return fc.length > 0 &&
            !/auth|session|userId|currentUser|Bearer|requireSession|getServerSession|verifyToken/i.test(fc) &&
            !importsSecurityLib(fc);
        });

        if (unprotected.length > 0) return {
          confidence: "likely_gap",
          description: `Export routes may lack authentication: ${unprotected.join(", ")}`,
          affectedFiles: unprotected,
          recommendation: "Verify authentication on all export routes. Scope exports to the requesting user's data only.",
        };
        return null;
      },
    },
    {
      title: "Export data isolation",
      severity: "high",
      detect(_, paths) {
        const exportRoutes = paths.filter((p) => /\/(export|download|csv|pdf)/i.test(p));
        if (exportRoutes.length === 0) return null;
        return {
          confidence: "needs_review",
          description: "Export functionality detected. Cannot verify from code structure whether exports are scoped to the requesting user's data.",
          affectedFiles: exportRoutes,
          recommendation: "Manually verify: every export query must filter by the authenticated user's scope. A user must never be able to export another user's data.",
        };
      },
    },
  ],
};

const FILE_UPLOAD_PACK: SecurityPack = {
  id: "file_uploads",
  name: "File Upload Security",
  appliesWhen: (_, paths, content) =>
    pathsContain(paths, "upload") ||
    contentContains(content, /multer|formidable|uploadthing|S3.*upload|putObject|formData/i) !== null,
  checks: [
    {
      title: "File type validation on uploads",
      severity: "high",
      detect(_, paths, content) {
        // Broad pattern — covers standard libs, magic byte checks, and custom validators
        const hasTypeCheck = contentContains(content,
          /mimetype|fileType|file-type|allowedTypes|accept.*image|magic.*byte|89 50 4e 47|image\/jpeg|image\/png|image\/webp|ALLOWED_TYPES|ALLOWED_MIME|ALLOWED_LOGO|acceptedTypes|validateMimeType|validateFileType|checkMimeType|allowedMimeTypes|MIME_TYPES|mimeTypes|file-validation/i
        );

        // Also credit if any upload-handling file imports from a validation lib
        const uploadFiles = Object.entries(content).filter(([p]) => /upload/i.test(p));
        const hasValidationLib = uploadFiles.some(([, fc]) => importsSecurityLib(fc));

        if (!hasTypeCheck && !hasValidationLib) return {
          confidence: "likely_gap",
          description: "File upload detected but no MIME type or file type validation found.",
          recommendation: "Validate MIME type server-side using magic bytes (not just extension or Content-Type header). Use file-type library or manual byte comparison.",
        };
        return null;
      },
    },
    {
      title: "File size limits on uploads",
      severity: "medium",
      detect(_, paths, content) {
        const hasSizeLimit = contentContains(content,
          /maxSize|maxFileSize|limit.*mb|fileSize|MAX_SIZE|MAX_FILE_SIZE|MAX_LOGO_BYTES|MAX_AVATAR_BYTES|byteLength|content-length|Content-Length|413|validateContentLength|validateBufferSize|file-validation|\d+\s*\*\s*1024\s*\*\s*1024/i
        );

        if (!hasSizeLimit) return {
          confidence: "likely_gap",
          description: "No file size limits detected on upload handlers. Large uploads can cause DoS or inflate storage costs.",
          recommendation: "Set explicit file size limits server-side. Check Content-Length header first, then validate the buffer size after reading.",
        };
        return null;
      },
    },
  ],
};

const PAYMENT_PACK: SecurityPack = {
  id: "payment_security",
  name: "Payment & Billing Security",
  appliesWhen: (stack, _, content) =>
    stack.otherDeps.includes("stripe") ||
    contentContains(content, /stripe|paddle|paystack/i) !== null,
  checks: [
    {
      title: "Webhook signature verification — payment provider",
      severity: "critical",
      detect(_, paths, content) {
        const hasPaymentWebhook = pathsContain(paths, "webhook") &&
          contentContains(content, /stripe|paystack|paddle/i);
        if (!hasPaymentWebhook) return null;

        const hasVerification = contentContains(content,
          /constructEvent|stripe\.webhooks|verifyPaystackSignature|x-paystack-signature|wh\.verify|verifySignature|createHmac|signature/i
        );
        const webhookFiles = Object.entries(content).filter(([p]) => /webhook/i.test(p));
        const hasLib = webhookFiles.some(([, fc]) => importsSecurityLib(fc));

        if (!hasVerification && !hasLib) return {
          confidence: "likely_gap",
          description: "Payment webhook routes detected without signature verification. Anyone can send fake payment events.",
          recommendation: "Use the payment provider's SDK to verify webhook signatures. Read raw body BEFORE parsing JSON.",
        };
        return null;
      },
    },
    {
      title: "Payment amount validated server-side",
      severity: "critical",
      detect(_, paths) {
        return {
          confidence: "needs_review",
          description: "Payment integration detected. Cannot verify whether payment amounts are validated server-side before creating charges.",
          recommendation: "Never trust amounts from the client. Always calculate the final price server-side based on your database, then pass it to the payment provider.",
        };
      },
    },
  ],
};

const DEPENDENCY_PACK: SecurityPack = {
  id: "dependencies",
  name: "Dependency Security",
  appliesWhen: () => true,
  checks: [
    {
      title: "Dependency vulnerability audit",
      severity: "medium",
      detect(_, paths, content) {
        const pkgJson = content["package.json"];
        if (!pkgJson) return null;

        let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } = {};
        try { pkg = JSON.parse(pkgJson); } catch { return null; }
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        const vulnerablePatterns: [string, string, string][] = [
          ["jsonwebtoken", "^8", "jsonwebtoken v8 has known vulnerabilities. Upgrade to v9+"],
          ["minimist", "^1.2.0", "minimist < 1.2.6 has prototype pollution. Pin to 1.2.8+"],
          ["axios", "^0", "axios 0.x has several known CVEs. Upgrade to 1.x"],
          ["node-fetch", "^1", "node-fetch v1 is deprecated with known issues. Use v3 or native fetch"],
        ];

        for (const [name, badVer, msg] of vulnerablePatterns) {
          if (deps[name]?.startsWith(badVer)) return {
            confidence: "confirmed",
            description: `Potentially vulnerable dependency: ${name}@${deps[name]}. ${msg}`,
            evidence: `"${name}": "${deps[name]}"`,
            recommendation: msg + " Run `npm audit` for a full report.",
          };
        }

        return {
          confidence: "recommended",
          description: "Run a dependency audit to check for known vulnerabilities.",
          recommendation: "Run `npm audit` regularly. Add it to your CI pipeline. Consider Dependabot or Renovate for automated updates.",
        };
      },
    },
  ],
};

const AUDIT_LOG_PACK: SecurityPack = {
  id: "audit_logging",
  name: "Audit Logging",
  appliesWhen: (_, paths) => pathsContain(paths, "admin", "approval", "manage"),
  checks: [
    {
      title: "Audit logging for sensitive actions",
      severity: "medium",
      detect(_, paths, content) {
        const hasAuditLog = contentContains(content,
          /audit.?log|auditLog|activity.?log|event.?log|log.?event|createAuditLog|writeLog|security.*log/i
        ) || pathsContain(paths, "audit_log", "audit-log", "activity_log", "audit.ts");

        if (!hasAuditLog) return {
          confidence: "likely_gap",
          description: "No audit logging detected for an app that handles admin actions or approvals.",
          recommendation: "Log: authentication events, data modifications, admin actions, approvals, exports, and permission changes. Store: who, what, when, from where.",
        };
        return null;
      },
    },
  ],
};

// Based on the Amospikins "AI Code Security Checklist v2.0" — covers the gaps
// not already caught by the packs above: SSRF, mass assignment, output
// encoding, token storage, supply-chain pinning, error handling, crypto
// defaults, prompt injection, and verify-before-ship process checks.
const AI_CHECKLIST_PACK: SecurityPack = {
  id: "ai_code_checklist",
  name: "AI Code Security Checklist",
  appliesWhen: () => true,
  checks: [
    {
      title: "Server-side fetch from user-supplied URL (SSRF)",
      severity: "high",
      detect(_, paths, content) {
        const found = contentContains(content, /fetch\(\s*(req\.|request\.|body\.|params\.|query\.)|axios\.(get|post)\(\s*(req\.|body\.|params\.|query\.)/i);
        if (!found) return null;
        const hasAllowlist = contentContains(content, /allowlist|allow.?list|ALLOWED_HOSTS|blockPrivateIp|isPrivateIP|ssrf/i);
        if (hasAllowlist) return null;
        return {
          confidence: "likely_gap",
          description: `Server-side request to a URL derived from user input found in ${found.file}, with no allowlist or private-IP guard detected. An attacker could point the server at internal services or cloud metadata endpoints (SSRF).`,
          affectedFiles: [found.file],
          evidence: found.match,
          recommendation: "Allow-list permitted destination hosts, resolve and block private/internal IP ranges, and never let user input choose an arbitrary host to call.",
        };
      },
    },
    {
      title: "Mass assignment — request body bound directly to a model",
      severity: "high",
      detect(_, paths, content) {
        const found = contentContains(content, /\.update\(\s*req\.body\s*\)|\.create\(\s*req\.body\s*\)|set\(\s*\.\.\.req\.body\s*\)|\.values\(\s*\.\.\.body\s*\)|\.update\(\{\s*\.\.\.body/i);
        if (!found) return null;
        return {
          confidence: "likely_gap",
          description: `An entire request body appears to be bound straight onto a database update/create in ${found.file}. An attacker could set fields like role, isAdmin, or balance simply by adding them to the request.`,
          affectedFiles: [found.file],
          evidence: found.match,
          recommendation: "Whitelist exactly which fields each endpoint accepts (e.g. via a Zod schema with .pick()/.strict()) instead of spreading the raw request body onto the model.",
        };
      },
    },
    {
      title: "User-controlled value rendered without escaping (XSS)",
      severity: "high",
      detect(_, paths, content) {
        const found = contentContains(content, /dangerouslySetInnerHTML[^}]*\{\{?\s*__html:\s*(req\.|props\.|input|user|comment|body\.|params\.)|v-html\s*=\s*["'`].*?(req\.|input|user)/i);
        if (!found) return null;
        return {
          confidence: "likely_gap",
          description: `Possible unescaped rendering of user-controlled content in ${found.file} (dangerouslySetInnerHTML/v-html bound to request or user data). This is the most common flaw in AI-generated UI code.`,
          affectedFiles: [found.file],
          evidence: found.match,
          recommendation: "Sanitise with a library like DOMPurify before rendering raw HTML, or avoid dangerouslySetInnerHTML/v-html entirely for user-controlled content.",
        };
      },
    },
    {
      title: "JWT or session token stored in localStorage/sessionStorage",
      severity: "high",
      detect(_, paths, content) {
        const found = contentContains(content, /localStorage\.setItem\(\s*['"`](token|jwt|access_?token|session|auth)['"`]|sessionStorage\.setItem\(\s*['"`](token|jwt|access_?token|session)['"`]/i);
        if (!found) return null;
        return {
          confidence: "confirmed",
          description: `Auth token stored in browser storage in ${found.file}. Any XSS on the page can read localStorage/sessionStorage and steal the token.`,
          affectedFiles: [found.file],
          evidence: found.match,
          recommendation: "Store session/JWT tokens in httpOnly, Secure, SameSite cookies instead. Never expose tokens to client-side JavaScript that doesn't strictly need them.",
        };
      },
    },
    {
      title: "Unpinned or wildcard dependency versions",
      severity: "medium",
      detect(_, paths, content) {
        const pkgJson = content["package.json"];
        if (!pkgJson) return null;
        let pkg: { dependencies?: Record<string, string> } = {};
        try { pkg = JSON.parse(pkgJson); } catch { return null; }
        const wildcard = Object.entries(pkg.dependencies ?? {}).filter(([, v]) => v === "*" || v === "latest");
        if (wildcard.length === 0) return null;
        return {
          confidence: "confirmed",
          description: `Dependencies pinned to "*" or "latest": ${wildcard.map(([n]) => n).join(", ")}. AI assistants sometimes invent package names or suggest unpinned/typosquatted ones.`,
          evidence: wildcard.map(([n, v]) => `${n}: ${v}`).join(", "),
          recommendation: "Pin every dependency to an exact or caret version, commit the lockfile, and verify the package name and source before installing anything an AI suggested.",
        };
      },
    },
    {
      title: "Error responses may leak stack traces or internal details",
      severity: "medium",
      detect(_, paths, content) {
        const found = contentContains(content, /res\.(json|send)\(\s*\{[^}]*\b(err|error)\.(stack|message)\b/i);
        if (!found) return null;
        return {
          confidence: "likely_gap",
          description: `Raw error object (stack/message) appears to be sent directly in an API response in ${found.file}. This can leak stack traces, file paths, or database details to the client.`,
          affectedFiles: [found.file],
          evidence: found.match,
          recommendation: "Return a generic safe message to the client ('Something went wrong') and log the full error server-side only.",
        };
      },
    },
    {
      title: "Math.random() used for tokens, IDs, or secrets",
      severity: "high",
      detect(_, paths, content) {
        const found = contentContains(content, /Math\.random\(\)[^;]*(token|secret|password|otp|reset|code|id\b)/i);
        if (!found) return null;
        return {
          confidence: "confirmed",
          description: `Math.random() used to generate something security-sensitive in ${found.file}. Math.random() is not cryptographically secure and its output is predictable.`,
          affectedFiles: [found.file],
          evidence: found.match,
          recommendation: "Use crypto.randomBytes() (Node) or crypto.getRandomValues() (browser) for tokens, OTPs, reset codes, and any value that must be unguessable.",
        };
      },
    },
    {
      title: "LLM call with unseparated user input (prompt injection)",
      severity: "high",
      detect(_, paths, content) {
        const found = contentContains(content, /(openai|anthropic|generateText|chat\.completions\.create)\([^)]*\$\{[^}]*(req\.|body\.|input|userMessage|prompt)\b/i);
        if (!found) return null;
        return {
          confidence: "needs_review",
          description: `An LLM call in ${found.file} appears to interpolate user input directly into the prompt with no visible separation between trusted instructions and untrusted content. Prompt injection is the top-ranked risk for AI applications.`,
          affectedFiles: [found.file],
          recommendation: "Keep system instructions separate from user content (e.g. system message vs. user message), never let model output trigger dangerous actions unchecked, and validate/sanitise anything the LLM returns before acting on it.",
        };
      },
    },
    {
      title: "No abuse-case or negative tests detected",
      severity: "low",
      detect(_, paths) {
        const hasTests = pathsContain(paths, ".test.", ".spec.", "__tests__", "/tests/");
        if (!hasTests) return null;
        const hasAbuseTests = pathsContain(paths, "unauthorized", "forbidden", "invalid", "abuse", "security.test", "rate-limit.test");
        if (hasAbuseTests) return null;
        return {
          confidence: "recommended",
          description: "Test files exist, but none appear to target abuse cases (invalid input, wrong role, expired/missing token, changed IDs, duplicate requests).",
          recommendation: "Add tests that try to misuse each sensitive feature — not just the happy path. Cover invalid input, missing/expired tokens, wrong roles, and tampered IDs.",
        };
      },
    },
    {
      title: "No automated security scanning in CI",
      severity: "low",
      detect(_, paths) {
        const ciFiles = paths.filter((p) => /\.github\/workflows\/.*\.ya?ml$|\.gitlab-ci\.ya?ml$/i.test(p));
        if (ciFiles.length === 0) return {
          confidence: "recommended",
          description: "No CI workflow files detected. Without CI, linting, tests, and secret/dependency scanning aren't enforced before merge.",
          recommendation: "Add a CI workflow that runs linting, unit tests, secret scanning, and dependency/SAST scanning on every pull request before it can merge.",
        };
        return null;
      },
    },
  ],
};

// ─── Pack registry ─────────────────────────────────────────────────────────────

export const ALL_PACKS: SecurityPack[] = [
  BASELINE_PACK,
  AUTH_PACK,
  API_SECURITY_PACK,
  RBAC_PACK,
  DATABASE_PACK,
  EXPORT_PACK,
  FILE_UPLOAD_PACK,
  PAYMENT_PACK,
  DEPENDENCY_PACK,
  AUDIT_LOG_PACK,
  AI_CHECKLIST_PACK,
];

// ─── Main analysis ────────────────────────────────────────────────────────────

export function runSecurityAnalysis(
  stack: DetectedStack,
  paths: string[],
  content: Record<string, string>
): { findings: SecurityFinding[]; appliedPacks: string[]; safeToShipScore: number } {
  const findings: SecurityFinding[] = [];
  const appliedPacks: string[] = [];

  for (const pack of ALL_PACKS) {
    if (!pack.appliesWhen(stack, paths, content)) continue;
    appliedPacks.push(pack.name);

    for (const check of pack.checks) {
      const result = check.detect(stack, paths, content);
      if (result) {
        findings.push({
          pack: pack.name,
          title: check.title,
          description: result.description,
          confidence: result.confidence,
          severity: check.severity,
          affectedFiles: result.affectedFiles,
          recommendation: result.recommendation,
          codeEvidence: result.evidence,
        });
      }
    }
  }

  return { findings, appliedPacks, safeToShipScore: calculateScore(findings) };
}

function calculateScore(findings: SecurityFinding[]): number {
  let deductions = 0;
  const weights: Record<ConfidenceLevel, number> = {
    confirmed: 1.0,
    likely_gap: 0.6,
    needs_review: 0.2,
    recommended: 0.0,
  };
  const severityPoints: Record<SeverityLevel, number> = {
    critical: 25,
    high: 12,
    medium: 6,
    low: 2,
    info: 0,
  };

  for (const f of findings) {
    deductions += severityPoints[f.severity] * weights[f.confidence];
  }

  return Math.max(0, Math.min(100, Math.round(100 - deductions)));
}

export function scoreLabel(score: number): { label: string; color: string; bgColor: string } {
  if (score >= 80) return { label: "Safe to Ship", color: "text-emerald-700", bgColor: "bg-emerald-50 border-emerald-200" };
  if (score >= 65) return { label: "Needs Attention", color: "text-amber-700", bgColor: "bg-amber-50 border-amber-200" };
  if (score >= 45) return { label: "Not Ready", color: "text-orange-700", bgColor: "bg-orange-50 border-orange-200" };
  return { label: "Critical Issues", color: "text-red-700", bgColor: "bg-red-50 border-red-200" };
}
