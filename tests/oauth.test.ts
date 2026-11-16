import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  appOrigin,
  isAllowedRedirectUri,
  isOwnResource,
  isValidChallenge,
  safeCallbackPath,
  verifyPkce,
} from "@/lib/oauth";

describe("PKCE", () => {
  const verifier = "a".repeat(43) + "-._~";
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  it("accepts the matching verifier", () => {
    expect(isValidChallenge(challenge)).toBe(true);
    expect(verifyPkce(verifier, challenge)).toBe(true);
  });

  it("rejects a wrong or malformed verifier", () => {
    expect(verifyPkce("b".repeat(43), challenge)).toBe(false);
    expect(verifyPkce("short", challenge)).toBe(false);
    expect(verifyPkce(challenge, challenge)).toBe(false); // "plain" method is not allowed
  });
});

describe("isAllowedRedirectUri", () => {
  it("allows https and loopback http", () => {
    expect(isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback")).toBe(true);
    expect(isAllowedRedirectUri("http://localhost:6274/callback")).toBe(true);
    expect(isAllowedRedirectUri("http://127.0.0.1:33418/")).toBe(true);
  });

  it("rejects other schemes, plain http and fragments", () => {
    expect(isAllowedRedirectUri("http://evil.example/cb")).toBe(false);
    expect(isAllowedRedirectUri("javascript:alert(1)")).toBe(false);
    expect(isAllowedRedirectUri("https://claude.ai/cb#x")).toBe(false);
    expect(isAllowedRedirectUri("https://user:pw@claude.ai/cb")).toBe(false);
    expect(isAllowedRedirectUri(42)).toBe(false);
  });
});

describe("isOwnResource", () => {
  const origin = "https://crm.example";
  it("accepts this server or no resource", () => {
    expect(isOwnResource(null, origin)).toBe(true);
    expect(isOwnResource("https://crm.example/api/mcp", origin)).toBe(true);
    expect(isOwnResource("https://crm.example/api/mcp/", origin)).toBe(true);
    expect(isOwnResource("https://crm.example", origin)).toBe(true);
  });
  it("rejects other servers", () => {
    expect(isOwnResource("https://other.example/api/mcp", origin)).toBe(false);
  });
});

describe("safeCallbackPath", () => {
  it("keeps same-site paths from absolute or relative URLs", () => {
    expect(safeCallbackPath("/oauth/authorize?client_id=x&state=y")).toBe("/oauth/authorize?client_id=x&state=y");
    expect(safeCallbackPath("https://crm.example/oauth/authorize?a=1")).toBe("/oauth/authorize?a=1");
  });
  it("never yields a protocol-relative path", () => {
    expect(safeCallbackPath("//evil.example/x")).toBe("/x");
    expect(safeCallbackPath("")).toBe(null);
    expect(safeCallbackPath(undefined)).toBe(null);
  });
});

describe("appOrigin", () => {
  it("uses forwarded headers", () => {
    const h = new Headers({ host: "internal:3000", "x-forwarded-host": "crm.example", "x-forwarded-proto": "https" });
    expect(appOrigin(h)).toBe("https://crm.example");
  });
  it("defaults localhost to http", () => {
    expect(appOrigin(new Headers({ host: "localhost:3000" }))).toBe("http://localhost:3000");
  });
});
