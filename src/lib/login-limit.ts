import "server-only";
import { prisma } from "@/lib/db";

const WINDOW_MS = 15 * 60 * 1000;
export const EMAIL_LIMIT = 5;
export const IP_LIMIT = 30;

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Records an attempt before the password is checked, then counts. Each request counts
 * after its own insert, so a burst of parallel guesses can't all slip under the limit.
 * Returns the reserved row ids, or null when the email or IP is over its limit.
 */
export async function reserveLoginAttempt(email: string, ip: string): Promise<string[] | null> {
  const since = new Date(Date.now() - WINDOW_MS);
  const emailKey = `email:${email}`;
  const ipKey = `ip:${ip}`;
  await prisma.loginAttempt.deleteMany({
    where: { key: { in: [emailKey, ipKey] }, createdAt: { lt: since } },
  });
  const rows = await prisma.loginAttempt.createManyAndReturn({
    data: [{ key: emailKey }, { key: ipKey }],
    select: { id: true },
  });
  const [byEmail, byIp] = await Promise.all([
    prisma.loginAttempt.count({ where: { key: emailKey, createdAt: { gte: since } } }),
    prisma.loginAttempt.count({ where: { key: ipKey, createdAt: { gte: since } } }),
  ]);
  return byEmail <= EMAIL_LIMIT && byIp <= IP_LIMIT ? rows.map((r) => r.id) : null;
}

/** A correct password clears that email's failures and un-counts this attempt for the IP. */
export async function clearLoginAttempts(email: string, reserved: string[]): Promise<void> {
  await prisma.loginAttempt.deleteMany({
    where: { OR: [{ key: `email:${email}` }, { id: { in: reserved } }] },
  });
}
