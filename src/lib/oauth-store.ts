import "server-only";
import { prisma } from "@/lib/db";
import {
  ACCESS_TTL_MS,
  CODE_TTL_MS,
  REFRESH_TTL_MS,
  SCOPE,
  randomToken,
  safeEqual,
  sha256,
} from "@/lib/oauth";

export async function findClient(clientId: string) {
  if (!clientId || clientId.length > 100) return null;
  return prisma.oAuthClient.findUnique({ where: { id: clientId } });
}

/** Checks client_secret for confidential clients; public clients pass with none. */
export function clientAuthOk(client: { secretHash: string | null }, secret: string | null): boolean {
  if (!client.secretHash) return true;
  return Boolean(secret) && safeEqual(sha256(secret!), client.secretHash);
}

export async function createCode(input: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  resource: string | null;
}): Promise<string> {
  const code = randomToken("crm_code_");
  await prisma.$transaction([
    prisma.oAuthClient.updateMany({ where: { id: input.clientId, approvedAt: null }, data: { approvedAt: new Date() } }),
    prisma.oAuthCode.create({
      data: { ...input, codeHash: sha256(code), expiresAt: new Date(Date.now() + CODE_TTL_MS) },
    }),
  ]);
  return code;
}

/** Single use: the code row is deleted as it is redeemed. */
export async function redeemCode(code: string) {
  const codeHash = sha256(code);
  const row = await prisma.oAuthCode.findUnique({ where: { codeHash } });
  if (!row) return null;
  const { count } = await prisma.oAuthCode.deleteMany({ where: { codeHash } });
  if (count !== 1 || row.expiresAt < new Date()) return null;
  return row;
}

function freshTokens() {
  const accessToken = randomToken("crm_at_");
  const refreshToken = randomToken("crm_rt_");
  const now = Date.now();
  return {
    accessToken,
    refreshToken,
    data: {
      accessHash: sha256(accessToken),
      accessExpiresAt: new Date(now + ACCESS_TTL_MS),
      refreshHash: sha256(refreshToken),
      refreshExpiresAt: new Date(now + REFRESH_TTL_MS),
    },
  };
}

export function tokenResponse(t: { accessToken: string; refreshToken: string }) {
  return {
    access_token: t.accessToken,
    token_type: "Bearer",
    expires_in: Math.floor(ACCESS_TTL_MS / 1000),
    refresh_token: t.refreshToken,
    scope: SCOPE,
  };
}

export async function createGrant(clientId: string, userId: string, resource: string | null) {
  const t = freshTokens();
  await prisma.oAuthGrant.create({ data: { clientId, userId, resource, ...t.data } });
  return t;
}

/**
 * Rotates the refresh token; the old one stops working. Reusing a replaced refresh token
 * means it leaked (OAuth 2.1 §4.3.1), so the whole grant is revoked.
 */
export async function refreshGrant(refreshToken: string, clientId: string) {
  const refreshHash = sha256(refreshToken);
  const grant = await prisma.oAuthGrant.findUnique({ where: { refreshHash } });
  if (!grant) {
    await prisma.oAuthGrant.deleteMany({ where: { previousRefreshHash: refreshHash, clientId } });
    return null;
  }
  if (grant.clientId !== clientId || grant.refreshExpiresAt < new Date()) return null;
  const t = freshTokens();
  const { count } = await prisma.oAuthGrant.updateMany({
    where: { id: grant.id, refreshHash },
    data: { ...t.data, previousRefreshHash: refreshHash },
  });
  if (count === 1) return t;
  // Lost a race with another refresh of the same token: treat it as reuse.
  await prisma.oAuthGrant.deleteMany({ where: { id: grant.id } });
  return null;
}

export async function revokeToken(token: string, clientId: string) {
  const hash = sha256(token);
  await prisma.oAuthGrant.deleteMany({
    where: { clientId, OR: [{ accessHash: hash }, { refreshHash: hash }] },
  });
}

const TOUCH_MS = 5 * 60 * 1000;

/** The user behind a valid access token, or null. */
export async function userForAccessToken(token: string): Promise<{ userId: string; clientId: string } | null> {
  if (!token.startsWith("crm_at_")) return null;
  const grant = await prisma.oAuthGrant.findUnique({
    where: { accessHash: sha256(token) },
    select: { id: true, userId: true, clientId: true, accessExpiresAt: true },
  });
  if (!grant || grant.accessExpiresAt < new Date()) return null;
  const now = new Date();
  await prisma.oAuthGrant.updateMany({
    where: { id: grant.id, OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: new Date(now.getTime() - TOUCH_MS) } }] },
    data: { lastUsedAt: now },
  });
  return { userId: grant.userId, clientId: grant.clientId };
}

export const UNAPPROVED_CLIENT_TTL_MS = 24 * 60 * 60 * 1000;

export async function sweepExpired() {
  const now = new Date();
  await prisma.$transaction([
    prisma.oAuthCode.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.oAuthGrant.deleteMany({ where: { refreshExpiresAt: { lt: now } } }),
    // Registered clients nobody ever approved. Approved ones stay so they can reconnect.
    prisma.oAuthClient.deleteMany({
      where: {
        approvedAt: null,
        createdAt: { lt: new Date(now.getTime() - UNAPPROVED_CLIENT_TTL_MS) },
        codes: { none: {} },
      },
    }),
  ]);
}
