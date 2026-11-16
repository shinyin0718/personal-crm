import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/dal";
import { logout } from "@/app/(auth)/actions";
import { PageHeader, cardClass, secondaryButtonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const userId = await requireUserId();
  const [session, count] = await Promise.all([auth(), prisma.person.count({ where: { userId } })]);
  return (
    <>
      <PageHeader title="Account" />
      <div className="space-y-4">
        <section className={cardClass}>
          <p className="font-medium">{session?.user?.name || session?.user?.email}</p>
          {session?.user?.name && <p className="text-sm text-stone-600">{session.user.email}</p>}
        </section>
        <section className={`${cardClass} space-y-3`}>
          <h2 className="text-base font-semibold">Export {count} people</h2>
          <div className="flex flex-wrap gap-2">
            <a href="/api/export?format=csv" className={secondaryButtonClass}>Spreadsheet (CSV)</a>
            <a href="/api/export?format=vcf" className={secondaryButtonClass}>Contacts (vCard)</a>
          </div>
        </section>
        <form action={logout}>
          <button className={secondaryButtonClass}>Sign out</button>
        </form>
      </div>
    </>
  );
}
