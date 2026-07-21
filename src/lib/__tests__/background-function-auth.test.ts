import { describe, expect, it } from "vitest";
import {
  signBackgroundPayload,
  verifyBackgroundPayload,
  verifyBackgroundRequest,
} from "@/lib/background-function-auth";

describe("background-function-auth", () => {
  const secret = "test-secret";
  const body = JSON.stringify({ projectId: "p1", documentType: "prd", userId: "u1" });

  it("signs and verifies matching payloads", () => {
    const signature = signBackgroundPayload(body, secret);
    expect(verifyBackgroundPayload(body, signature, secret)).toBe(true);
  });

  it("rejects tampered payloads", () => {
    const signature = signBackgroundPayload(body, secret);
    expect(verifyBackgroundPayload(`${body}x`, signature, secret)).toBe(false);
  });

  it("rejects missing secret or signature", () => {
    const signature = signBackgroundPayload(body, secret);
    expect(verifyBackgroundPayload(body, signature, undefined)).toBe(false);
    expect(verifyBackgroundPayload(body, null, secret)).toBe(false);
  });

  it("reads signature from request headers", () => {
    const signature = signBackgroundPayload(body, secret);
    expect(
      verifyBackgroundRequest(body, { "x-background-signature": signature }, secret)
    ).toBe(true);
  });
});
