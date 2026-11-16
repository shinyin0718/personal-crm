import type { Metadata } from "next";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { ConfirmDeleteForm } from "@/components/ConfirmButton";
import { formatDate } from "@/lib/dates";
import { appOrigin, mcpUrl } from "@/lib/oauth";
import { disconnectApp } from "./actions";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/dal";
import { logout } from "@/app/(auth)/actions";
import { PageHeader, cardClass, secondaryButtonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const userId = await requireUserId();
  const [session, count, grants, h] = await Promise.all([
    auth(),
    prisma.person.count({ where: { userId } }),
    prisma.oAuthGrant.findMany({
      where: { userId },
      select: { id: true, createdAt: true, lastUsedAt: true, client: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    headers(),
  ]);
  const connectorUrl = mcpUrl(appOrigin(h));
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
        <section className={`${cardClass} space-y-3`}>
          <h2 className="text-base font-semibold">Connect Claude</h2>
          <p className="text-sm text-stone-600">
            Let Claude read your people and meeting notes, summarise meetings and research people before you meet.
            In Claude, open <span className="font-medium">Customize → Connectors → + Add → Add custom connector</span>{" "}
            and paste this URL:
          </p>
          <code className="block rounded-lg bg-stone-100 px-3 py-2 text-sm break-all select-all">{connectorUrl}</code>
          {grants.length > 0 && (
            <ul className="divide-y divide-stone-100 border-t border-stone-100">
              {grants.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3 py-3 last:pb-0">
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-medium">{g.client.name}</p>
                    <p className="text-stone-500">
                      Connected {formatDate(g.createdAt)}
                      {g.lastUsedAt && ` · last used ${formatDate(g.lastUsedAt)}`}
                    </p>
                  </div>
                  <ConfirmDeleteForm
                    action={disconnectApp.bind(null, g.id)}
                    label="Disconnect"
                    question={`Disconnect ${g.client.name}? It will lose access to your CRM.`}
                    className={secondaryButtonClass}
                    pendingText="Disconnecting…"
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
        <form action={logout}>
          <button className={secondaryButtonClass}>Sign out</button>
        </form>
      </div>
    </>
  );
}
