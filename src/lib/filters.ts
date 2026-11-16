import type { Prisma } from "@/generated/prisma/client";
import { parseDateInput } from "@/lib/dates";

export interface PeopleFilters {
  q: string;
  company: string;
  event: string;
  tag: string;
  from: string;
  to: string;
  sort: "recent" | "name";
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

type Params = Record<string, string | string[] | undefined>;

export function parseFilters(params: Params): PeopleFilters {
  const one = (k: string) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 200) ?? "";
  };
  const date = (k: string) => (DATE.test(one(k)) ? one(k) : "");
  return {
    q: one("q"),
    company: one("company"),
    event: one("event"),
    tag: one("tag"),
    from: date("from"),
    to: date("to"),
    sort: one("sort") === "name" ? "name" : "recent",
  };
}

/** Number of filters set besides the search box and sort order. */
export function activeFilterCount(f: PeopleFilters): number {
  return [f.company, f.event, f.tag, f.from || f.to].filter(Boolean).length;
}

const contains = (value: string) => ({ contains: value, mode: "insensitive" as const });

export function buildPeopleWhere(userId: string, f: PeopleFilters): Prisma.PersonWhereInput {
  const AND: Prisma.PersonWhereInput[] = [];
  if (f.q) {
    AND.push({
      OR: [
        { name: contains(f.q) },
        { company: contains(f.q) },
        { email: contains(f.q) },
        { role: contains(f.q) },
        { interactions: { some: { location: contains(f.q) } } },
      ],
    });
  }
  if (f.company) AND.push({ company: contains(f.company) });
  if (f.tag) AND.push({ tags: { some: { name: { equals: f.tag, mode: "insensitive" } } } });

  const meeting: Prisma.InteractionWhereInput = {};
  if (f.event) meeting.location = contains(f.event);
  if (f.from || f.to) {
    meeting.metAt = {
      ...(f.from && { gte: parseDateInput(f.from) }),
      ...(f.to && { lte: parseDateInput(f.to) }),
    };
  }
  if (Object.keys(meeting).length) AND.push({ interactions: { some: meeting } });

  return AND.length ? { userId, AND } : { userId };
}
