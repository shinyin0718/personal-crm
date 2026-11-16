import type { Metadata } from "next";
import { requireUserId } from "@/lib/dal";
import { PersonForm } from "@/components/PersonForm";
import { PageHeader } from "@/components/ui";
import { createPerson } from "../../actions";
import { formOptions } from "../options";

export const metadata: Metadata = { title: "Add person" };

export default async function NewPersonPage() {
  const userId = await requireUserId();
  return (
    <>
      <PageHeader title="Add person" />
      <PersonForm action={createPerson} mode="create" submitLabel="Save" {...await formOptions(userId)} />
    </>
  );
}
