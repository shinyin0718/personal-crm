// Demo data for local development: `npm run db:seed` (login demo@example.com / demo-password).
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const day = (s: string) => new Date(`${s}T00:00:00.000Z`);

const PEOPLE = [
  {
    name: "Aisha Rahman", company: "Grab", role: "Product Manager", email: "aisha.rahman@example.com",
    phone: "+60 12-345 6789", linkedinUrl: "https://www.linkedin.com/in/aisha-rahman-example", tags: ["fintech", "mentor"],
    meetings: [
      { metAt: "2026-11-12", location: "KL Tech Week", notes: "Talked about BNPL adoption in SEA. Wants to see the demo." },
      { metAt: "2026-09-03", location: "Coffee at Bangsar", notes: "Introduced by Wei Jie." },
    ],
  },
  {
    name: "Daniel Tan", company: "Shopee", role: "Senior Engineer", email: "daniel.tan@example.com",
    tags: ["engineering"], meetings: [{ metAt: "2026-11-12", location: "KL Tech Week", notes: "Rust + Postgres nerd." }],
  },
  {
    name: "Priya Nair", company: "Maybank", role: "Head of Partnerships", phone: "+60 17-222 3344",
    tags: ["fintech", "partner"], meetings: [{ metAt: "2026-10-21", location: "Fintech Summit Singapore", notes: "Follow up in December about a pilot." }],
  },
  { name: "Lim Wei Jie", company: "Independent", role: "Angel investor", tags: ["investor"], meetings: [{ metAt: "2026-08-15", location: "Startup mixer", notes: null }] },
];

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: { email: "demo@example.com", name: "Demo User", passwordHash: await bcrypt.hash("demo-password", 10) },
  });
  await prisma.person.deleteMany({ where: { userId: user.id } });
  await prisma.tag.deleteMany({ where: { userId: user.id } });
  for (const { tags, meetings, ...p } of PEOPLE) {
    await prisma.person.create({
      data: {
        ...p,
        userId: user.id,
        tags: {
          connectOrCreate: tags.map((name) => ({
            where: { userId_name: { userId: user.id, name } },
            create: { userId: user.id, name },
          })),
        },
        interactions: { create: meetings.map((m) => ({ ...m, metAt: day(m.metAt), userId: user.id })) },
      },
    });
  }
  console.log(`Seeded ${PEOPLE.length} people for demo@example.com`);
}

main().finally(() => prisma.$disconnect());
