/** Trusted public documentation domains for authoritative enrichment. */
export const AUTHORITATIVE_DOMAINS = [
  "datatracker.ietf.org",
  "tools.ietf.org",
  "rfc-editor.org",
  "owasp.org",
  "cheatsheetseries.owasp.org",
  "developer.mozilla.org",
  "learn.microsoft.com",
  "docs.github.com",
  "cloud.google.com",
  "docs.aws.amazon.com",
  "auth0.com",
  "stripe.com",
  "nodejs.org",
  "react.dev",
  "nextjs.org",
  "postgresql.org",
  "redis.io",
  "kubernetes.io",
  "w3.org",
  "arxiv.org",
  "nginx.org",
  "docker.com",
  "supabase.com",
  "clerk.com",
  "swagger.io",
] as const;

export function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

export function isAuthoritativeHostname(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  return AUTHORITATIVE_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`)
  );
}

export function authoritativeDomainHint(category: string): string[] {
  switch (category) {
    case "security_compliance":
      return ["owasp.org", "datatracker.ietf.org", "cheatsheetseries.owasp.org"];
    case "api_design":
      return ["datatracker.ietf.org", "developer.mozilla.org", "swagger.io"];
    case "frontend_ux_patterns":
      return ["developer.mozilla.org", "react.dev", "w3.org"];
    case "database_persistence":
      return ["postgresql.org", "redis.io", "developer.mozilla.org"];
    case "devops_deployment":
      return ["kubernetes.io", "docker.com", "learn.microsoft.com"];
    default:
      return [...AUTHORITATIVE_DOMAINS.slice(0, 8)];
  }
}
