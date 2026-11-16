import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { toDateInput } from "@/lib/dates";
import { toCsv, toVcard, type ExportPerson } from "@/lib/export";

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const format = new URL(req.url).searchParams.get("format") === "vcf" ? "vcf" : "csv";
  const rows = await prisma.person.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    include: {
      tags: { select: { name: true }, orderBy: { name: "asc" } },
      interactions: { orderBy: { metAt: "desc" }, select: { metAt: true, location: true, notes: true } },
    },
  });
  const people: ExportPerson[] = rows.map((p) => ({
    ...p,
    tags: p.tags.map((t) => t.name),
    meetings: p.interactions.map((i) => ({ ...i, metAt: toDateInput(i.metAt) })),
  }));

  const date = new Date().toISOString().slice(0, 10);
  const body = format === "vcf" ? toVcard(people) : toCsv(people);
  return new Response(format === "csv" ? `\uFEFF${body}` : body, {
    headers: {
      "Content-Type": format === "vcf" ? "text/vcard; charset=utf-8" : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="people-${date}.${format}"`,
      "Cache-Control": "no-store",
    },
  });
}
