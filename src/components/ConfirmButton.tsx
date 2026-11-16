"use client";

import { SubmitButton } from "./SubmitButton";
import { dangerButtonClass } from "./ui";

export function ConfirmDeleteForm({
  action,
  label,
  question,
  className = dangerButtonClass,
}: {
  action: () => Promise<void>;
  label: string;
  question: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(question)) e.preventDefault();
      }}
    >
      <SubmitButton className={className} pendingText="Deleting…">
        {label}
      </SubmitButton>
    </form>
  );
}
