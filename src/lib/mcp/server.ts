import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isDateInput, parseDateInput, toDateInput } from "@/lib/dates";
import { buildPeopleWhere } from "@/lib/filters";
import { setTags } from "@/lib/people";
import { normalizeLinkedinUrl, parseTags } from "@/lib/validation";

const INSTRUCTIONS = `This is the user's personal CRM: people they have met and notes from each meeting.
Use search_people or search_meetings to find records, then get_person for the full meeting timeline.
For research, use your own web search and combine it with what the CRM says; save useful findings with
add_person_note only when the user asks. Every write is visible in the CRM app.`;

const date = z.string().refine(isDateInput, "Use YYYY-MM-DD");
const limit = z.number().int().min(1).max(100).default(25);

function result(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function failure(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

const personSummary = {
  id: true,
  name: true,
  company: true,
  role: true,
  email: true,
  tags: { select: { name: true }, orderBy: { name: "asc" } },
  interactions: { select: { metAt: true, location: true }, orderBy: { metAt: "desc" }, take: 1 },
  _count: { select: { interactions: true } },
} as const;

type Summary = {
  id: string;
  name: string;
  company: string | null;
  role: string | null;
  email: string | null;
  tags: { name: string }[];
  interactions: { metAt: Date; location: string | null }[];
  _count: { interactions: number };
};

function summarize(p: Summary) {
  const last = p.interactions[0];
  return {
    id: p.id,
    name: p.name,
    company: p.company,
    role: p.role,
    email: p.email,
    tags: p.tags.map((t) => t.name),
    meetings: p._count.interactions,
    lastMet: last ? toDateInput(last.metAt) : null,
    lastMetAt: last?.location ?? null,
  };
}

/** A fresh MCP server whose every tool is scoped to `userId`. */
export function createCrmServer(userId: string, appUrl: string) {
  const server = new McpServer({ name: "personal-crm", version: "1.0.0" }, { instructions: INSTRUCTIONS });
  const personLink = (id: string) => `${appUrl}/people/${id}`;

  server.registerTool(
    "search_people",
    {
      title: "Search people",
      description:
        "Find people in the CRM. `query` matches name, company, email, role or meeting place. Leave everything empty to list people, most recently added first.",
      inputSchema: {
        query: z.string().max(200).optional(),
        company: z.string().max(200).optional(),
        tag: z.string().max(40).optional(),
        metAt: z.string().max(200).optional().describe("Event or place where you met"),
        metFrom: date.optional().describe("Met on or after (YYYY-MM-DD)"),
        metTo: date.optional().describe("Met on or before (YYYY-MM-DD)"),
        limit,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (a) => {
      const where = buildPeopleWhere(userId, {
        q: a.query?.trim() ?? "",
        company: a.company?.trim() ?? "",
        tag: a.tag?.trim() ?? "",
        event: a.metAt?.trim() ?? "",
        from: a.metFrom ?? "",
        to: a.metTo ?? "",
        sort: "recent",
      });
      const [total, people] = await Promise.all([
        prisma.person.count({ where }),
        prisma.person.findMany({ where, select: personSummary, orderBy: { createdAt: "desc" }, take: a.limit }),
      ]);
      return result({ total, people: people.map(summarize) });
    },
  );

  server.registerTool(
    "get_person",
    {
      title: "Get person",
      description: "Full details for one person, including every meeting with its notes (newest first).",
      inputSchema: { personId: z.string().max(50) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ personId }) => {
      const p = await prisma.person.findFirst({
        where: { id: personId, userId },
        include: {
          tags: { select: { name: true }, orderBy: { name: "asc" } },
          interactions: { orderBy: [{ metAt: "desc" }, { createdAt: "desc" }] },
        },
      });
      if (!p) return failure("No person with that id. Use search_people to find one.");
      return result({
        id: p.id,
        name: p.name,
        company: p.company,
        role: p.role,
        email: p.email,
        phone: p.phone,
        linkedinUrl: p.linkedinUrl,
        tags: p.tags.map((t) => t.name),
        notes: p.notes,
        addedOn: toDateInput(p.createdAt),
        link: personLink(p.id),
        meetings: p.interactions.map((i) => ({
          id: i.id,
          date: toDateInput(i.metAt),
          location: i.location,
          notes: i.notes,
        })),
      });
    },
  );

  server.registerTool(
    "search_meetings",
    {
      title: "Search meetings",
      description:
        "Meeting notes across everyone, newest first. `query` matches the notes or place. Use a date range to review a period, e.g. last week's meetings.",
      inputSchema: {
        query: z.string().max(200).optional(),
        personId: z.string().max(50).optional(),
        from: date.optional().describe("On or after (YYYY-MM-DD)"),
        to: date.optional().describe("On or before (YYYY-MM-DD)"),
        limit,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (a) => {
      const q = a.query?.trim();
      const meetings = await prisma.interaction.findMany({
        where: {
          userId,
          ...(a.personId && { personId: a.personId }),
          ...(q && {
            OR: [
              { notes: { contains: q, mode: "insensitive" } },
              { location: { contains: q, mode: "insensitive" } },
            ],
          }),
          ...((a.from || a.to) && {
            metAt: { ...(a.from && { gte: parseDateInput(a.from) }), ...(a.to && { lte: parseDateInput(a.to) }) },
          }),
        },
        include: { person: { select: { id: true, name: true, company: true } } },
        orderBy: [{ metAt: "desc" }, { createdAt: "desc" }],
        take: a.limit,
      });
      return result(
        meetings.map((i) => ({
          id: i.id,
          date: toDateInput(i.metAt),
          location: i.location,
          notes: i.notes,
          person: i.person,
        })),
      );
    },
  );

  server.registerTool(
    "list_tags",
    {
      title: "List tags",
      description: "All tags in the CRM with how many people have each.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const tags = await prisma.tag.findMany({
        where: { userId },
        select: { name: true, _count: { select: { people: true } } },
        orderBy: { name: "asc" },
      });
      return result(tags.map((t) => ({ name: t.name, people: t._count.people })));
    },
  );

  server.registerTool(
    "add_meeting",
    {
      title: "Add meeting",
      description: "Record a meeting with a person: the date, where, and notes (e.g. a summary and next steps).",
      inputSchema: {
        personId: z.string().max(50),
        date: date.describe("YYYY-MM-DD"),
        location: z.string().trim().max(200).optional(),
        notes: z.string().trim().max(10000).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (a) => {
      const person = await prisma.person.findFirst({ where: { id: a.personId, userId }, select: { id: true } });
      if (!person) return failure("No person with that id. Use search_people to find one.");
      const i = await prisma.interaction.create({
        data: {
          userId,
          personId: person.id,
          metAt: parseDateInput(a.date),
          location: a.location || null,
          notes: a.notes || null,
        },
      });
      return result({ saved: true, meetingId: i.id, link: personLink(person.id) });
    },
  );

  server.registerTool(
    "add_person_note",
    {
      title: "Add note to person",
      description:
        "Append text (e.g. research findings or a follow-up reminder) to a person's notes. Existing notes are kept.",
      inputSchema: { personId: z.string().max(50), note: z.string().trim().min(1).max(4000) },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ personId, note }) => {
      const stamped = `[${toDateInput(new Date())}] ${note}`;
      // Compare-and-swap so concurrent appends don't overwrite each other.
      for (let attempt = 0; attempt < 5; attempt++) {
        const p = await prisma.person.findFirst({ where: { id: personId, userId }, select: { id: true, notes: true } });
        if (!p) return failure("No person with that id. Use search_people to find one.");
        const notes = p.notes ? `${p.notes}\n\n${stamped}` : stamped;
        if (notes.length > 5000) return failure("Notes would exceed 5000 characters. Shorten the note.");
        const { count } = await prisma.person.updateMany({ where: { id: p.id, userId, notes: p.notes }, data: { notes } });
        if (count === 1) return result({ saved: true, link: personLink(p.id) });
      }
      return failure("The notes kept changing while saving. Try again.");
    },
  );

  server.registerTool(
    "add_person",
    {
      title: "Add person",
      description: "Add a new person to the CRM. Check search_people first to avoid duplicates.",
      inputSchema: {
        name: z.string().trim().min(1).max(200),
        company: z.string().trim().max(200).optional(),
        role: z.string().trim().max(200).optional(),
        email: z.email().max(200).optional(),
        phone: z.string().trim().max(50).optional(),
        linkedinUrl: z.string().max(300).optional(),
        notes: z.string().trim().max(5000).optional(),
        tags: z.array(z.string().max(40)).max(20).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (a) => {
      const linkedinUrl = a.linkedinUrl ? normalizeLinkedinUrl(a.linkedinUrl) : null;
      if (a.linkedinUrl && !linkedinUrl) return failure("linkedinUrl must be a linkedin.com link.");
      const tags = parseTags((a.tags ?? []).join(","));
      const p = await prisma.$transaction(async (tx) => {
        const created = await tx.person.create({
          data: {
            userId,
            name: a.name,
            company: a.company || null,
            role: a.role || null,
            email: a.email?.toLowerCase() || null,
            phone: a.phone || null,
            linkedinUrl,
            notes: a.notes || null,
          },
        });
        if (tags.length) await setTags(tx, userId, created.id, tags);
        return created;
      });
      return result({ saved: true, personId: p.id, link: personLink(p.id) });
    },
  );

  return server;
}
