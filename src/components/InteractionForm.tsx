"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { FormState } from "@/app/(app)/actions";
import { DateInput } from "./DateInput";
import { SubmitButton } from "./SubmitButton";
import { Field, FormError, inputClass } from "./ui";

export function InteractionForm({
  action,
  initial = {},
  submitLabel,
  events = [],
  idPrefix = "i",
}: {
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  initial?: { metAt?: string; location?: string; notes?: string };
  submitLabel: string;
  events?: string[];
  idPrefix?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const [round, setRound] = useState(0);
  const prev = useRef(state);
  useEffect(() => {
    // A successful save returns {}: clear the form for the next entry.
    if (state !== prev.current && !state.errors) setRound((r) => r + 1);
    prev.current = state;
  }, [state]);

  const v = { ...initial, ...state.values } as Record<string, string | undefined>;
  const e = state.errors ?? {};
  const k = `${round}-${state.values ? JSON.stringify(state.values).length : 0}`;
  const id = (n: string) => `${idPrefix}-${n}`;

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={e.form} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" htmlFor={id("metAt")} error={e.metAt}>
          <DateInput key={`d-${k}`} id={id("metAt")} name="metAt" defaultValue={v.metAt} required />
        </Field>
        <Field label="Event or place" htmlFor={id("location")} optional error={e.location}>
          <input
            key={`l-${k}`}
            id={id("location")}
            name="location"
            defaultValue={v.location ?? ""}
            list={id("events")}
            className={inputClass}
          />
          <datalist id={id("events")}>
            {events.map((ev) => (
              <option key={ev} value={ev} />
            ))}
          </datalist>
        </Field>
      </div>
      <Field label="Notes" htmlFor={id("notes")} optional error={e.notes}>
        <textarea
          key={`n-${k}`}
          id={id("notes")}
          name="notes"
          rows={3}
          defaultValue={v.notes ?? ""}
          placeholder="What did you talk about?"
          className={inputClass}
        />
      </Field>
      <div className="flex justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
