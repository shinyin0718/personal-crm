import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/dal";
import { cardFieldsFromJson } from "@/lib/vision/parse";
import { ConfirmDeleteForm } from "@/components/ConfirmButton";
import { PersonForm } from "@/components/PersonForm";
import { SubmitButton } from "@/components/SubmitButton";
import { PageHeader, secondaryButtonClass } from "@/components/ui";
import { createPerson } from "../../actions";
import { formOptions } from "../../people/options";
import { discardScan, retryScan } from "../actions";

export const metadata: Metadata = { title: "Check details" };

export default async function ReviewScanPage({ params }: PageProps<"/scan/[id]">) {
  const userId = await requireUserId();
  const { id } = await params;
  const scan = await prisma.cardScan.findFirst({ where: { id, userId } });
  if (!scan) notFound();
  if (scan.status === "CONFIRMED") redirect(scan.personId ? `/people/${scan.personId}` : "/people");

  const fields = cardFieldsFromJson(scan.extractedJson);
  const initial = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v ?? ""]));
  const failed = scan.status !== "EXTRACTED";

  return (
    <>
      <PageHeader title="Check details" />
      {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked image */}
      <img src={scan.imageUrl} alt="Business card" className="mb-4 max-h-64 w-full rounded-xl border border-stone-200 bg-white object-contain" />
      {failed && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>Couldn&apos;t read this card. Try again or type the details.</p>
          <form action={retryScan.bind(null, scan.id)}>
            <SubmitButton className={secondaryButtonClass} pendingText="Reading…">Try again</SubmitButton>
          </form>
        </div>
      )}
      <PersonForm
        action={createPerson}
        initial={initial}
        mode="create"
        scanId={scan.id}
        submitLabel="Save person"
        {...await formOptions(userId)}
      />
      <div className="mt-10 border-t border-stone-200 pt-4">
        <ConfirmDeleteForm action={discardScan.bind(null, scan.id)} label="Discard card" question="Discard this card photo?" />
      </div>
    </>
  );
}
