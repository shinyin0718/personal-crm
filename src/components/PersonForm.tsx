"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/(app)/actions";
import { DateInput } from "./DateInput";
import { SubmitButton } from "./SubmitButton";
import { Field, FormError, cardClass, inputClass } from "./ui";

export type PersonValues = Partial<
  Record<"name" | "email" | "phone" | "company" | "role" | "linkedinUrl" | "notes" | "tags", string>
>;

export function PersonForm({
  action,
  initial = {},
  mode,
  scanId,
  submitLabel,
  events = [],
  tagOptions = [],
}: {
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  initial?: PersonValues;
  mode: "create" | "edit";
  scanId?: string;
  submitLabel: string;
  events?: string[];
  tagOptions?: string[];
}) {
  const [state, formAction] = useActionState(action, {});
  const v = { ...initial, ...state.values } as Record<string, string | undefined>;
  const e = state.errors ?? {};
  // Remount fields after a failed submit so they show the submitted values.
  const k = state.values ? JSON.stringify(state.values).length : 0;

  const text = (
    name: string,
    label: string,
    opts: { optional?: boolean; type?: string; placeholder?: string; autoComplete?: string } = {},
  ) => (
    <Field label={label} htmlFor={name} optional={opts.optional} error={e[name]}>
      <input
        key={`${name}-${k}`}
        id={name}
        name={name}
        type={opts.type ?? "text"}
        defaultValue={v[name] ?? ""}
        placeholder={opts.placeholder}
        autoComplete={opts.autoComplete ?? "off"}
        className={inputClass}
      />
    </Field>
  );

  return (
    <form action={formAction} className="space-y-4">
      {scanId && <input type="hidden" name="scanId" value={scanId} />}
      <FormError message={e.form} />
      <div className={`${cardClass} space-y-4`}>
        {text("name", "Name")}
        <div className="grid gap-4 sm:grid-cols-2">
          {text("company", "Company", { optional: true })}
          {text("role", "Role", { optional: true })}
          {text("email", "Email", { optional: true, type: "email" })}
          {text("phone", "Phone", { optional: true, type: "tel" })}
        </div>
        {text("linkedinUrl", "LinkedIn", {
          optional: true,
          placeholder: "linkedin.com/in/…",
        })}
        <Field label="Tags" htmlFor="tags" optional error={e.tags}>
          <input
            key={`tags-${k}`}
            id="tags"
            name="tags"
            defaultValue={v.tags ?? ""}
            placeholder="e.g. investor, conference"
            list="tag-options"
            className={inputClass}
          />
          <datalist id="tag-options">
            {tagOptions.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>
        {mode === "edit" && (
          <Field label="Notes" htmlFor="notes" optional error={e.notes}>
            <textarea
              key={`notes-${k}`}
              id="notes"
              name="notes"
              rows={3}
              defaultValue={v.notes ?? ""}
              className={inputClass}
            />
          </Field>
        )}
      </div>

      {mode === "create" && (
        <div className={`${cardClass} space-y-4`}>
          <h2 className="text-base font-semibold text-stone-900">Where you met</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date" htmlFor="metAt" error={e.metAt}>
              <DateInput key={`metAt-${k}`} id="metAt" name="metAt" defaultValue={v.metAt} />
            </Field>
            <Field label="Event or place" htmlFor="location" optional error={e.location}>
              <input
                key={`location-${k}`}
                id="location"
                name="location"
                defaultValue={v.location ?? ""}
                list="event-options"
                className={inputClass}
              />
              <datalist id="event-options">
                {events.map((ev) => (
                  <option key={ev} value={ev} />
                ))}
              </datalist>
            </Field>
          </div>
          <Field label="Notes" htmlFor="meetingNotes" optional error={e.meetingNotes}>
            <textarea
              key={`meetingNotes-${k}`}
              id="meetingNotes"
              name="meetingNotes"
              rows={3}
              defaultValue={v.meetingNotes ?? ""}
              placeholder="What did you talk about?"
              className={inputClass}
            />
          </Field>
        </div>
      )}

      <div className="flex justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
