"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/dal";
import { parseDateInput } from "@/lib/dates";
import { deletePersonAndFiles, setTags } from "@/lib/people";
import {
  fieldErrors,
  firstMeetingSchema,
  formValues,
  interactionSchema,
  personSchema,
  type FieldErrors,
} from "@/lib/validation";

export interface FormState {
  errors?: FieldErrors;
  values?: Record<string, string>;
}

const PERSON_KEYS = ["name", "email", "phone", "company", "role", "linkedinUrl", "notes", "tags"] as const;
const MEETING_KEYS = ["metAt", "location", "meetingNotes"] as const;

export async function createPerson(_prev: FormState, fd: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const values = formValues(fd, [...PERSON_KEYS, ...MEETING_KEYS, "scanId"]);
  const person = personSchema.safeParse(values);
  const meeting = firstMeetingSchema.safeParse({
    metAt: values.metAt,
    location: values.location,
    notes: values.meetingNotes,
  });
  if (!person.success || !meeting.success) {
    const { notes: meetingNotes, ...meetingErrors } = meeting.success ? {} : fieldErrors(meeting.error);
    const errors: FieldErrors = {
      ...(person.success ? {} : fieldErrors(person.error)),
      ...meetingErrors,
      ...(meetingNotes && { meetingNotes }),
    };
    return { errors, values };
  }
  const m = meeting.data;
  if (!m.metAt && (m.location || m.notes)) {
    return { errors: { metAt: "Pick the date you met" }, values };
  }

  const scan = values.scanId
    ? await prisma.cardScan.findFirst({
        where: { id: values.scanId, userId, status: { not: "CONFIRMED" } },
      })
    : null;
  if (values.scanId && !scan) return { errors: { form: "This card was already saved." }, values };

  const { tags, ...data } = person.data;
  const created = await prisma.$transaction(async (tx) => {
    if (scan) {
      // Claim the scan first so two concurrent saves can't both reuse its photo.
      const claimed = await tx.cardScan.updateMany({
        where: { id: scan.id, userId, status: { not: "CONFIRMED" } },
        data: { status: "CONFIRMED" },
      });
      if (claimed.count !== 1) return null;
    }
    const p = await tx.person.create({
      data: { ...data, userId, cardImageUrl: scan?.imageUrl ?? null },
    });
    if (tags.length) await setTags(tx, userId, p.id, tags);
    if (m.metAt) {
      await tx.interaction.create({
        data: {
          userId,
          personId: p.id,
          metAt: parseDateInput(m.metAt),
          location: m.location,
          notes: m.notes,
        },
      });
    }
    if (scan) {
      await tx.cardScan.update({
        where: { id: scan.id, userId },
        data: { personId: p.id },
      });
    }
    return p;
  });
  if (!created) return { errors: { form: "This card was already saved." }, values };
  redirect(`/people/${created.id}`);
}

export async function updatePerson(
  personId: string,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const userId = await requireUserId();
  const values = formValues(fd, PERSON_KEYS);
  const parsed = personSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const exists = await prisma.person.findFirst({ where: { id: personId, userId }, select: { id: true } });
  if (!exists) notFound();

  const { tags, ...data } = parsed.data;
  await prisma.$transaction(async (tx) => {
    await tx.person.update({ where: { id: personId, userId }, data });
    await setTags(tx, userId, personId, tags);
  });
  redirect(`/people/${personId}`);
}

export async function deletePerson(personId: string) {
  const userId = await requireUserId();
  await deletePersonAndFiles(userId, personId);
  redirect("/people");
}

const INTERACTION_KEYS = ["metAt", "location", "notes"] as const;

export async function createInteraction(
  personId: string,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const userId = await requireUserId();
  const values = formValues(fd, INTERACTION_KEYS);
  const parsed = interactionSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const person = await prisma.person.findFirst({ where: { id: personId, userId }, select: { id: true } });
  if (!person) notFound();

  await prisma.interaction.create({
    data: { ...parsed.data, metAt: parseDateInput(parsed.data.metAt), userId, personId },
  });
  revalidatePath(`/people/${personId}`);
  return {};
}

export async function updateInteraction(
  interactionId: string,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const userId = await requireUserId();
  const values = formValues(fd, INTERACTION_KEYS);
  const parsed = interactionSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const interaction = await prisma.interaction.findFirst({
    where: { id: interactionId, userId },
    select: { personId: true },
  });
  if (!interaction) notFound();

  await prisma.interaction.update({
    where: { id: interactionId, userId },
    data: { ...parsed.data, metAt: parseDateInput(parsed.data.metAt) },
  });
  redirect(`/people/${interaction.personId}`);
}

export async function deleteInteraction(interactionId: string) {
  const userId = await requireUserId();
  const interaction = await prisma.interaction.findFirst({
    where: { id: interactionId, userId },
    select: { personId: true },
  });
  if (!interaction) notFound();
  await prisma.interaction.delete({ where: { id: interactionId, userId } });
  redirect(`/people/${interaction.personId}`);
}
