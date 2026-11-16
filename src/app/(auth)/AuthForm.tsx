"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/app/(app)/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { Field, FormError, buttonClass, cardClass, inputClass } from "@/components/ui";

export function AuthForm({
  mode,
  action,
}: {
  mode: "login" | "signup";
  action: (s: FormState, fd: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useActionState(action, {});
  const e = state.errors ?? {};
  const v = state.values ?? {};
  const signup = mode === "signup";
  return (
    <form action={formAction} className={`${cardClass} space-y-4`}>
      <h1 className="text-xl font-semibold">{signup ? "Create account" : "Sign in"}</h1>
      <FormError message={e.form} />
      {signup && (
        <Field label="Name" htmlFor="name" optional error={e.name}>
          <input id="name" name="name" autoComplete="name" defaultValue={v.name} className={inputClass} />
        </Field>
      )}
      <Field label="Email" htmlFor="email" error={e.email}>
        <input id="email" name="email" type="email" required autoComplete="email" defaultValue={v.email} className={inputClass} />
      </Field>
      <Field label="Password" htmlFor="password" error={e.password}>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={signup ? 8 : undefined}
          autoComplete={signup ? "new-password" : "current-password"}
          className={inputClass}
        />
      </Field>
      <SubmitButton className={`${buttonClass} w-full`} pendingText={signup ? "Creating…" : "Signing in…"}>
        {signup ? "Create account" : "Sign in"}
      </SubmitButton>
      <p className="text-center text-sm text-stone-600">
        {signup ? "Have an account? " : "New here? "}
        <Link href={signup ? "/login" : "/signup"} className="font-medium text-teal-700 hover:underline">
          {signup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
