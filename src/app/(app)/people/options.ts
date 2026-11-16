import "server-only";
import { prisma } from "@/lib/db";

/** Past events and tags, offered as suggestions in forms. */
export async function formOptions(userId: string) {
  const [events, tags] = await Promise.all([
    prisma.interaction.findMany({
      where: { userId, location: { not: null } },
      distinct: ["location"],
      select: { location: true },
      orderBy: { location: "asc" },
      take: 200,
    }),
    prisma.tag.findMany({ where: { userId }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  return { events: events.map((e) => e.location!), tagOptions: tags.map((t) => t.name) };
}
