import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRemoteDocument } from "@/lib/eie/parsers/url";

describe("fetchRemoteDocument", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("re-validates redirect targets before following", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.redirect !== "manual") {
          throw new Error("Expected manual redirect handling");
        }
        if (url === "https://example.com/start") {
          return new Response(null, {
            status: 302,
            headers: { location: "http://169.254.169.254/latest/meta-data" },
          });
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      })
    );

    await expect(fetchRemoteDocument("https://example.com/start")).rejects.toThrow(
      /private or reserved IP/i
    );
  });

  it("follows safe redirects and returns text content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.redirect !== "manual") {
          throw new Error("Expected manual redirect handling");
        }
        if (url === "https://example.com/start") {
          return new Response(null, {
            status: 302,
            headers: { location: "/final" },
          });
        }
        if (url === "https://example.com/final") {
          return new Response("hello world", {
            status: 200,
            headers: { "content-type": "text/plain" },
          });
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      })
    );

    await expect(fetchRemoteDocument("https://example.com/start")).resolves.toBe("hello world");
  });
});
