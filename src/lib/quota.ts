import { prisma } from "@/lib/db";
import { dailyScanLimit } from "@/lib/limits";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Atomically use one card read from the user's daily quota. Kept on User so deleting scans can't reset it. */
export async function takeScanCredit(userId: string): Promise<boolean> {
  const now = new Date();
  const restarted = await prisma.user.updateMany({
    where: {
      id: userId,
      OR: [{ scanWindowStart: null }, { scanWindowStart: { lt: new Date(now.getTime() - DAY_MS) } }],
    },
    data: { scanWindowStart: now, scanCount: 1 },
  });
  if (restarted.count) return true;
  const used = await prisma.user.updateMany({
    where: { id: userId, scanCount: { lt: dailyScanLimit() } },
    data: { scanCount: { increment: 1 } },
  });
  return used.count === 1;
}
