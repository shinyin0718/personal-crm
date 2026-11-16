import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/dal";
import { toDateInput } from "@/lib/dates";
import { ConfirmDeleteForm } from "@/components/ConfirmButton";
import { InteractionForm } from "@/components/InteractionForm";
import { PageHeader, cardClass } from "@/components/ui";
import { deleteInteraction, updateInteraction } from "@/app/(app)/actions";
import { formOptions } from "../../../../options";

export const metadata: Metadata = { title: "Edit meeting" };

export default async function EditInteractionPage({
  params,
}: PageProps<"/people/[id]/interactions/[interactionId]/edit">) {
  const userId = await requireUserId();
  const { id, interactionId } = await params;
  const interaction = await prisma.interaction.findFirst({
    where: { id: interactionId, personId: id, userId },
    include: { person: { select: { name: true } } },
  });
  if (!interaction) notFound();
  const { events } = await formOptions(userId);
  return (
    <>
      <PageHeader title={`Meeting with ${interaction.person.name}`} />
      <div className={cardClass}>
        <InteractionForm
          action={updateInteraction.bind(null, interaction.id)}
          initial={{
            metAt: toDateInput(interaction.metAt),
            location: interaction.location ?? "",
            notes: interaction.notes ?? "",
          }}
          submitLabel="Save"
          events={events}
        />
      </div>
      <div className="mt-10 border-t border-stone-200 pt-4">
        <ConfirmDeleteForm
          action={deleteInteraction.bind(null, interaction.id)}
          label="Delete meeting"
          question="Delete this meeting?"
        />
      </div>
    </>
  );
}
