"use server";

import bcrypt from "bcryptjs";
import { AuthError, CredentialsSignin } from "next-auth";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { isEmailAllowed } from "@/lib/limits";
import { credentialsSchema, fieldErrors, formValues, signupSchema } from "@/lib/validation";
import type { FormState } from "@/app/(app)/actions";

async function signInWithPassword(email: string, password: string): Promise<FormState | never> {
  try {
    await signIn("credentials", { email, password, redirectTo: "/people" });
  } catch (err) {
    if (err instanceof CredentialsSignin && err.code === "rate_limited") {
      return { errors: { form: "Too many login attempts. Try again in 15 minutes." }, values: { email } };
    }
    if (err instanceof AuthError) {
      return { errors: { form: "Wrong email or password." }, values: { email } };
    }
    throw err; // the redirect on success is thrown as an error too
  }
  return {};
}

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd, ["email", "password"]);
  const parsed = credentialsSchema.safeParse(values);
  if (!parsed.success) {
    return { errors: { form: "Wrong email or password." }, values: { email: values.email } };
  }
  return signInWithPassword(parsed.data.email, parsed.data.password);
}

export async function signup(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd, ["name", "email", "password"]);
  const parsed = signupSchema.safeParse(values);
  const safeValues = { name: values.name, email: values.email };
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: safeValues };

  const { email, password, name } = parsed.data;
  if (!isEmailAllowed(email)) {
    return { errors: { email: "Sign-up is invite-only. Ask the owner to add your email." }, values: safeValues };
  }
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return { errors: { email: "An account with this email already exists." }, values: safeValues };
  }
  await prisma.user.create({
    data: { email, name, passwordHash: await bcrypt.hash(password, 12) },
  });
  return signInWithPassword(email, password);
}

export async function googleSignIn() {
  await signIn("google", { redirectTo: "/people" });
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
