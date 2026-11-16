import "server-only";
import { prisma } from "@/lib/db";
import { deleteFileByUrl } from "@/lib/storage";
import type { Prisma } from "@/generated/prisma/client";

/** Replace a person's tags, creating new ones and dropping tags nobody uses any more. */
export async function setTags(
  tx: Prisma.TransactionClient,
  userId: string,
  personId: string,
  names: string[],
) {
  const tags = await Promise.all(
    names.map((name) =>
      tx.tag.upsert({
        where: { userId_name: { userId, name } },
        create: { userId, name },
        update: {},
        select: { id: true },
      }),
    ),
  );
  await tx.person.update({
    where: { id: personId, userId },
    data: { tags: { set: tags } },
  });
  await tx.tag.deleteMany({ where: { userId, people: { none: {} } } });
}

export async function deletePersonAndFiles(userId: string, personId: string) {
  const person = await prisma.person.findFirst({
    where: { id: personId, userId },
    select: { cardImageUrl: true, cardScans: { select: { id: true, imageUrl: true } } },
  });
  if (!person) return false;
  await prisma.$transaction([
    prisma.cardScan.deleteMany({ where: { userId, personId } }),
    prisma.person.delete({ where: { id: personId, userId } }),
    prisma.tag.deleteMany({ where: { userId, people: { none: {} } } }),
  ]);
  const urls = new Set([person.cardImageUrl, ...person.cardScans.map((s) => s.imageUrl)]);
  await Promise.all([...urls].map(deleteFileByUrl));
  return true;
}
