import dns from "node:dns/promises";
import net from "node:net";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google",
]);

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    if (normalized.startsWith("fe80")) return true;
  }

  return false;
}

function assertAllowedProtocol(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs are allowed");
  }
}

function assertAllowedHostname(hostname: string): void {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(host)) {
    throw new Error("URL hostname is not allowed");
  }
  if (host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("URL hostname is not allowed");
  }
  if (net.isIP(host) && isPrivateIp(host)) {
    throw new Error("URL resolves to a private or reserved IP address");
  }
}

async function assertResolvedPublicIps(hostname: string): Promise<void> {
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error("URL resolves to a private or reserved IP address");
    }
    return;
  }

  const results = await dns.lookup(hostname, { all: true, verbatim: true });
  if (results.length === 0) {
    throw new Error("URL hostname could not be resolved");
  }

  for (const result of results) {
    if (isPrivateIp(result.address)) {
      throw new Error("URL resolves to a private or reserved IP address");
    }
  }
}

export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }

  assertAllowedProtocol(url);
  assertAllowedHostname(url.hostname);
  await assertResolvedPublicIps(url.hostname);

  return url;
}

export function isPublicUrlSync(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    assertAllowedProtocol(url);
    assertAllowedHostname(url.hostname);
    return true;
  } catch {
    return false;
  }
}
