import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { googleEnabled } from "@/auth";
import { cardClass } from "@/components/ui";
import { passwordSignupEnabled } from "@/lib/limits";
import { signup } from "../actions";
import { AuthForm } from "../AuthForm";
import { GoogleButton } from "../GoogleButton";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage() {
  await connection(); // read sign-up settings at request time, not when the image was built
  if (passwordSignupEnabled()) {
    return (
      <>
        <AuthForm mode="signup" action={signup} />
        {googleEnabled && <GoogleButton />}
      </>
    );
  }
  return (
    <div className={`${cardClass} space-y-4`}>
      <h1 className="text-xl font-semibold">Create account</h1>
      {googleEnabled ? (
        <>
          <p className="text-sm text-stone-600">New accounts sign up with Google, so we know the email is yours.</p>
          <GoogleButton />
        </>
      ) : (
        <p className="text-sm text-stone-600">Sign-up isn&apos;t open yet. Ask the owner for access.</p>
      )}
      <p className="text-center text-sm text-stone-600">
        Have an account?{" "}
        <Link href="/login" className="font-medium text-teal-700 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
