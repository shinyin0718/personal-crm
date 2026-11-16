"use client";

import { inputClass } from "./ui";

function todayLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Date input that defaults to today in the browser's time zone. */
export function DateInput({
  id,
  name,
  defaultValue,
  defaultToday = true,
  required,
}: {
  id: string;
  name: string;
  defaultValue?: string;
  defaultToday?: boolean;
  required?: boolean;
}) {
  return (
    <input
      id={id}
      name={name}
      type="date"
      defaultValue={defaultValue}
      ref={(el) => {
        if (el && !el.value && defaultToday) el.value = todayLocal();
      }}
      required={required}
      className={inputClass}
    />
  );
}
