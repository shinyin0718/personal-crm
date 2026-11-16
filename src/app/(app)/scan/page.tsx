import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/dal";
import { formatDate } from "@/lib/dates";
import { cardFieldsFromJson } from "@/lib/vision/parse";
import { CardUpload } from "@/components/CardUpload";
import { PageHeader, cardClass } from "@/components/ui";

export const metadata: Metadata = { title: "Scan card" };

export default async function ScanPage() {
  const userId = await requireUserId();
  const pending = await prisma.cardScan.findMany({
    where: { userId, status: { in: ["EXTRACTED", "FAILED", "PROCESSING"] } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return (
    <>
      <PageHeader title="Scan card" />
      <div className={cardClass}>
        <CardUpload />
      </div>
      {pending.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-base font-semibold">Not saved yet</h2>
          <ul className="divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200 bg-white">
            {pending.map((s) => {
              const name = cardFieldsFromJson(s.extractedJson).name;
              return (
                <li key={s.id}>
                  <Link href={`/scan/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">
                    {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked image */}
                    <img src={s.imageUrl} alt="" className="h-10 w-16 rounded border border-stone-200 object-cover" />
                    <span className="min-w-0 flex-1 truncate font-medium">{name ?? "Unreadable card"}</span>
                    <span className="text-xs text-stone-500">{formatDate(s.createdAt)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
