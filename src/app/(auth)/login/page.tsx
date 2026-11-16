import type { Metadata } from "next";
import { googleEnabled } from "@/auth";
import { safeCallbackPath } from "@/lib/oauth";
import { login } from "../actions";
import { AuthForm } from "../AuthForm";
import { GoogleButton } from "../GoogleButton";

export const metadata: Metadata = { title: "Sign in" };

const OAUTH_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked: "This email already has a password account. Sign in with your password.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error, callbackUrl: rawCallback } = await searchParams;
  const callbackUrl = safeCallbackPath(rawCallback);
  const message = typeof error === "string" ? (OAUTH_ERRORS[error] ?? "Sign-in failed. Try again.") : null;
  return (
    <>
      {message && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>}
      <AuthForm mode="login" action={login} callbackUrl={callbackUrl} />
      {googleEnabled && <GoogleButton callbackUrl={callbackUrl} />}
    </>
  );
}
