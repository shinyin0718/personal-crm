import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/dal";
import { ConfirmDeleteForm } from "@/components/ConfirmButton";
import { PersonForm } from "@/components/PersonForm";
import { PageHeader } from "@/components/ui";
import { deletePerson, updatePerson } from "../../../actions";
import { formOptions } from "../../options";

export const metadata: Metadata = { title: "Edit" };

export default async function EditPersonPage({ params }: PageProps<"/people/[id]/edit">) {
  const userId = await requireUserId();
  const { id } = await params;
  const person = await prisma.person.findFirst({
    where: { id, userId },
    include: { tags: { select: { name: true }, orderBy: { name: "asc" } } },
  });
  if (!person) notFound();
  const { tagOptions } = await formOptions(userId);
  const initial = {
    name: person.name,
    email: person.email ?? "",
    phone: person.phone ?? "",
    company: person.company ?? "",
    role: person.role ?? "",
    linkedinUrl: person.linkedinUrl ?? "",
    notes: person.notes ?? "",
    tags: person.tags.map((t) => t.name).join(", "),
  };
  return (
    <>
      <PageHeader title={`Edit ${person.name}`} />
      <PersonForm
        action={updatePerson.bind(null, person.id)}
        initial={initial}
        mode="edit"
        submitLabel="Save"
        tagOptions={tagOptions}
      />
      <div className="mt-10 border-t border-stone-200 pt-4">
        <ConfirmDeleteForm
          action={deletePerson.bind(null, person.id)}
          label="Delete person"
          question={`Delete ${person.name} and all their meetings?`}
        />
      </div>
    </>
  );
}
