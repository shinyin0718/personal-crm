import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const SCOPE = "crm";
export const MCP_PATH = "/api/mcp";
export const CODE_TTL_MS = 10 * 60 * 1000;
export const ACCESS_TTL_MS = 60 * 60 * 1000;
export const REFRESH_TTL_MS = 60 * 24 * 60 * 60 * 1000;

export function randomToken(prefix = ""): string {
  return prefix + randomBytes(32).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** PKCE S256: base64url(sha256(verifier)) must equal the challenge sent to /authorize. */
export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  return safeEqual(createHash("sha256").update(verifier).digest("base64url"), challenge);
}

export function isValidChallenge(challenge: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(challenge);
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Redirect URIs must be https (or http on loopback for local clients), with no fragment. */
export function isAllowedRedirectUri(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length > 500) return false;
  try {
    const url = new URL(raw);
    if (url.hash || url.username || url.password) return false;
    return url.protocol === "https:" || (url.protocol === "http:" && LOOPBACK.has(url.hostname));
  } catch {
    return false;
  }
}

/** Public origin of the app: AUTH_URL when pinned, otherwise the (proxy-forwarded) request host. */
export function appOrigin(headers: Headers): string {
  if (process.env.AUTH_URL) return new URL(process.env.AUTH_URL).origin;
  const host = headers.get("x-forwarded-host")?.split(",")[0].trim() || headers.get("host") || "localhost:3000";
  const proto =
    headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
    (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

export function mcpUrl(origin: string): string {
  return origin + MCP_PATH;
}

/** RFC 8707: a resource indicator, when sent, must name this MCP server. */
export function isOwnResource(resource: string | null | undefined, origin: string): boolean {
  if (!resource) return true;
  return resource.replace(/\/$/, "") === mcpUrl(origin) || resource.replace(/\/$/, "") === origin;
}

/** Turn a login callbackUrl (absolute or relative) into a same-site path, or null. */
export function safeCallbackPath(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const url = new URL(raw, "http://x");
    const path = url.pathname + url.search;
    return path.startsWith("/") && !path.startsWith("//") ? path : null;
  } catch {
    return null;
  }
}

export function withParams(base: string, params: Record<string, string | undefined | null>): string {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  return url.toString();
}
