import { describe, expect, it } from "vitest";
import { isPublicUrlSync } from "@/lib/eie/security/url-validator";

describe("url-validator", () => {
  it("rejects localhost URLs", () => {
    expect(isPublicUrlSync("http://localhost/admin")).toBe(false);
  });

  it("rejects metadata IP URLs", () => {
    expect(isPublicUrlSync("http://169.254.169.254/latest/meta-data")).toBe(false);
  });

  it("accepts public HTTPS URLs", () => {
    expect(isPublicUrlSync("https://example.com/docs/architecture.pdf")).toBe(true);
  });
});
