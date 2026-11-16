import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/dal";
import { formatDate } from "@/lib/dates";
import { activeFilterCount, buildPeopleWhere, parseFilters } from "@/lib/filters";
import { PageHeader, buttonClass, inputClass } from "@/components/ui";

export const metadata: Metadata = { title: "People" };

export default async function PeoplePage({ searchParams }: PageProps<"/people">) {
  const userId = await requireUserId();
  const f = parseFilters(await searchParams);
  const [rows, total, companies, events, tags] = await Promise.all([
    prisma.person.findMany({
      where: buildPeopleWhere(userId, f),
      take: 1000,
      orderBy: { name: "asc" },
      include: {
        tags: { select: { name: true }, orderBy: { name: "asc" } },
        interactions: { orderBy: { metAt: "desc" }, take: 1, select: { metAt: true, location: true } },
      },
    }),
    prisma.person.count({ where: { userId } }),
    prisma.person.findMany({
      where: { userId, company: { not: null } },
      distinct: ["company"],
      select: { company: true },
      orderBy: { company: "asc" },
    }),
    prisma.interaction.findMany({
      where: { userId, location: { not: null } },
      distinct: ["location"],
      select: { location: true },
      orderBy: { location: "asc" },
    }),
    prisma.tag.findMany({ where: { userId }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  const people =
    f.sort === "recent"
      ? [...rows].sort(
          (a, b) =>
            (b.interactions[0]?.metAt ?? b.createdAt).getTime() -
            (a.interactions[0]?.metAt ?? a.createdAt).getTime(),
        )
      : rows;
  const filterCount = activeFilterCount(f);
  const searching = Boolean(f.q) || filterCount > 0;

  if (total === 0) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">No one here yet</h1>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/scan" className={buttonClass}>Scan a card</Link>
          <Link href="/people/new" className="inline-flex items-center rounded-lg px-4 py-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-50">
            Add manually
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="People" />
      <form key={JSON.stringify(f)} className="mb-4 space-y-2" role="search">
        <div className="flex gap-2">
          <input
            name="q"
            type="search"
            defaultValue={f.q}
            placeholder="Search people or events"
            aria-label="Search"
            className={inputClass}
          />
          <select name="sort" defaultValue={f.sort} aria-label="Sort" className={`${inputClass} w-auto`}>
            <option value="recent">Recent</option>
            <option value="name">A–Z</option>
          </select>
        </div>
        <details open={filterCount > 0} className="rounded-lg border border-stone-200 bg-white">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-stone-700">
            Filters{filterCount > 0 && <span className="ml-1 rounded-full bg-teal-700 px-1.5 text-xs text-white">{filterCount}</span>}
          </summary>
          <div className="grid gap-3 border-t border-stone-200 p-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-stone-700">
              <span>Company</span>
              <input name="company" defaultValue={f.company} list="companies" className={inputClass} />
              <datalist id="companies">
                {companies.map((c) => <option key={c.company} value={c.company!} />)}
              </datalist>
            </label>
            <label className="space-y-1 text-sm text-stone-700">
              <span>Event or place</span>
              <input name="event" defaultValue={f.event} list="events" className={inputClass} />
              <datalist id="events">
                {events.map((e) => <option key={e.location} value={e.location!} />)}
              </datalist>
            </label>
            <label className="space-y-1 text-sm text-stone-700">
              <span>Met from</span>
              <input name="from" type="date" defaultValue={f.from} className={inputClass} />
            </label>
            <label className="space-y-1 text-sm text-stone-700">
              <span>Met until</span>
              <input name="to" type="date" defaultValue={f.to} className={inputClass} />
            </label>
            {tags.length > 0 && (
              <label className="space-y-1 text-sm text-stone-700">
                <span>Tag</span>
                <select name="tag" defaultValue={f.tag} className={inputClass}>
                  <option value="">Any</option>
                  {tags.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
              </label>
            )}
            <div className="flex items-end justify-end gap-2 sm:col-span-2">
              <Link href="/people" className="rounded-lg px-3 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-100">Clear</Link>
              <button className={buttonClass}>Apply</button>
            </div>
          </div>
        </details>
      </form>

      {searching && (
        <p className="mb-2 text-sm text-stone-500">
          {people.length} of {total}
        </p>
      )}
      {people.length === 0 ? (
        <p className="py-10 text-center text-stone-500">No matches.</p>
      ) : (
        <ul className="divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200 bg-white">
          {people.map((p) => {
            const last = p.interactions[0];
            const subtitle = [p.role, p.company].filter(Boolean).join(" · ");
            return (
              <li key={p.id}>
                <Link href={`/people/${p.id}`} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-stone-50">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-stone-900">{p.name}</p>
                    {subtitle && <p className="truncate text-sm text-stone-600">{subtitle}</p>}
                    {p.tags.length > 0 && (
                      <p className="mt-1 flex flex-wrap gap-1">
                        {p.tags.map((t) => (
                          <span key={t.name} className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">{t.name}</span>
                        ))}
                      </p>
                    )}
                  </div>
                  {last && (
                    <div className="max-w-[40%] shrink-0 text-right text-xs text-stone-500">
                      <p className="whitespace-nowrap">{formatDate(last.metAt)}</p>
                      {last.location && <p className="truncate">{last.location}</p>}
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
