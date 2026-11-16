import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/dal";
import { formatDate } from "@/lib/dates";
import { InteractionForm } from "@/components/InteractionForm";
import { PageHeader, cardClass, secondaryButtonClass } from "@/components/ui";
import { createInteraction } from "../../actions";
import { formOptions } from "../options";

async function getPerson(userId: string, id: string) {
  return prisma.person.findFirst({
    where: { id, userId },
    include: {
      tags: { select: { name: true }, orderBy: { name: "asc" } },
      interactions: { orderBy: [{ metAt: "desc" }, { createdAt: "desc" }] },
    },
  });
}

export async function generateMetadata({ params }: PageProps<"/people/[id]">): Promise<Metadata> {
  const userId = await requireUserId();
  const person = await getPerson(userId, (await params).id);
  return { title: person?.name ?? "Not found" };
}

export default async function PersonPage({ params }: PageProps<"/people/[id]">) {
  const userId = await requireUserId();
  const { id } = await params;
  const person = await getPerson(userId, id);
  if (!person) notFound();
  const { events } = await formOptions(userId);

  const subtitle = [person.role, person.company].filter(Boolean).join(" · ");
  const contacts = [
    person.email && { label: "Email", value: person.email, href: `mailto:${person.email}` },
    person.phone && { label: "Phone", value: person.phone, href: `tel:${person.phone.replace(/[^\d+]/g, "")}` },
    person.linkedinUrl && {
      label: "LinkedIn",
      value: person.linkedinUrl.replace(/^https:\/\/(www\.)?/, ""),
      href: person.linkedinUrl,
    },
  ].filter(Boolean) as { label: string; value: string; href: string }[];

  return (
    <>
      <PageHeader title={person.name}>
        <Link href={`/people/${person.id}/edit`} className={secondaryButtonClass}>Edit</Link>
      </PageHeader>

      <section className={`${cardClass} mb-4`}>
        <div className="flex flex-col-reverse gap-4 sm:flex-row">
          <div className="min-w-0 flex-1 space-y-3">
            {subtitle && <p className="text-stone-700">{subtitle}</p>}
            {contacts.length > 0 && (
              <dl className="space-y-1.5 text-sm">
                {contacts.map((c) => (
                  <div key={c.label} className="flex gap-2">
                    <dt className="w-16 shrink-0 text-stone-500">{c.label}</dt>
                    <dd className="min-w-0 wrap-anywhere">
                      <a
                        href={c.href}
                        className="text-teal-700 hover:underline"
                        {...(c.label === "LinkedIn" && { target: "_blank", rel: "noopener noreferrer" })}
                      >
                        {c.value}
                      </a>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {person.tags.length > 0 && (
              <p className="flex flex-wrap gap-1">
                {person.tags.map((t) => (
                  <Link
                    key={t.name}
                    href={`/people?tag=${encodeURIComponent(t.name)}`}
                    className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600 hover:bg-stone-200"
                  >
                    {t.name}
                  </Link>
                ))}
              </p>
            )}
            {person.notes && <p className="whitespace-pre-line text-sm text-stone-700">{person.notes}</p>}
          </div>
          {person.cardImageUrl && (
            <a href={person.cardImageUrl} target="_blank" className="self-start sm:shrink-0" aria-label="Open card photo">
              {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked image */}
              <img src={person.cardImageUrl} alt="" className="h-28 w-48 rounded-md border border-stone-200 object-cover sm:h-24 sm:w-40" />
            </a>
          )}
        </div>
      </section>

      <section className={`${cardClass} mb-4`}>
        <h2 className="mb-3 text-base font-semibold">Log a meeting</h2>
        <InteractionForm action={createInteraction.bind(null, person.id)} submitLabel="Add" events={events} idPrefix="new" />
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold">History</h2>
        {person.interactions.length === 0 ? (
          <p className="text-sm text-stone-500">No meetings logged yet.</p>
        ) : (
          <ol className="relative space-y-3 border-l-2 border-stone-200 pl-5">
            {person.interactions.map((i) => (
              <li key={i.id} className="relative">
                <span className="absolute top-4 -left-[27px] h-3 w-3 rounded-full border-2 border-white bg-teal-600" />
                <div className={cardClass}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm">
                      <span className="font-semibold">{formatDate(i.metAt)}</span>
                      {i.location && <span className="text-stone-600"> · {i.location}</span>}
                    </p>
                    <Link href={`/people/${person.id}/interactions/${i.id}/edit`} className="text-sm font-medium text-teal-700 hover:underline">
                      Edit
                    </Link>
                  </div>
                  {i.notes && <p className="mt-2 whitespace-pre-line text-sm text-stone-700">{i.notes}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
