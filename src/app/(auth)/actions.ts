"use server";

import bcrypt from "bcryptjs";
import { AuthError, CredentialsSignin } from "next-auth";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { isEmailAllowed, passwordSignupEnabled } from "@/lib/limits";
import { safeCallbackPath } from "@/lib/oauth";
import { credentialsSchema, fieldErrors, formValues, signupSchema } from "@/lib/validation";
import type { FormState } from "@/app/(app)/actions";

/** Where to land after signing in: a same-site callbackUrl (e.g. the Claude consent page) or /people. */
function redirectTarget(fd: FormData): string {
  return safeCallbackPath(fd.get("callbackUrl")) ?? "/people";
}

async function signInWithPassword(email: string, password: string, redirectTo: string): Promise<FormState | never> {
  try {
    await signIn("credentials", { email, password, redirectTo });
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
  return signInWithPassword(parsed.data.email, parsed.data.password, redirectTarget(fd));
}

export async function signup(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!passwordSignupEnabled()) return { errors: { form: "New accounts sign up with Google." } };
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
  return signInWithPassword(email, password, redirectTarget(fd));
}

export async function googleSignIn(fd: FormData) {
  await signIn("google", { redirectTo: redirectTarget(fd) });
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
