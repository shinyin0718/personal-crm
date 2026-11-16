import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { clientIp } from "@/lib/login-limit";
import { isAllowedRedirectUri, randomToken, sha256 } from "@/lib/oauth";
import { UNAPPROVED_CLIENT_TTL_MS, sweepExpired } from "@/lib/oauth-store";
import { oauthError } from "../client-auth";

const PER_IP_PER_HOUR = 10;
const MAX_UNAPPROVED = 200;

// RFC 7591 dynamic client registration (how Claude registers itself).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return oauthError("invalid_client_metadata", "Expected a JSON body");

  const uris = body.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0 || uris.length > 5 || !uris.every(isAllowedRedirectUri)) {
    return oauthError("invalid_redirect_uri", "redirect_uris must be 1-5 https (or loopback http) URLs");
  }
  const method = body.token_endpoint_auth_method ?? "none";
  if (method !== "none" && method !== "client_secret_post" && method !== "client_secret_basic") {
    return oauthError("invalid_client_metadata", "Unsupported token_endpoint_auth_method");
  }
  const grantTypes = body.grant_types ?? ["authorization_code", "refresh_token"];
  const responseTypes = body.response_types ?? ["code"];
  const name =
    (typeof body.client_name === "string" ? body.client_name.trim().slice(0, 100) : "") || "Unnamed app";

  await sweepExpired();
  const ip = clientIp(req.headers);
  const clientId = `crm_client_${randomBytes(16).toString("hex")}`;
  const clientSecret = method === "none" ? null : randomToken("crm_cs_");
  // Insert first, then count (including this row), so parallel requests can't all slip under the limits.
  const client = await prisma.oAuthClient.create({
    data: {
      id: clientId,
      name,
      redirectUris: uris as string[],
      secretHash: clientSecret ? sha256(clientSecret) : null,
      registrationIp: ip,
    },
  });
  const [fromIp, unapproved] = await Promise.all([
    prisma.oAuthClient.count({
      where: { registrationIp: ip, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
    }),
    prisma.oAuthClient.count({
      where: { approvedAt: null, createdAt: { gt: new Date(Date.now() - UNAPPROVED_CLIENT_TTL_MS) } },
    }),
  ]);
  if (fromIp > PER_IP_PER_HOUR || unapproved > MAX_UNAPPROVED) {
    await prisma.oAuthClient.deleteMany({ where: { id: clientId } });
    return oauthError("too_many_requests", "Too many app registrations. Try again later.", 429);
  }

  return Response.json(
    {
      client_id: client.id,
      ...(clientSecret && { client_secret: clientSecret, client_secret_expires_at: 0 }),
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      client_name: name,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: method,
      grant_types: grantTypes,
      response_types: responseTypes,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
