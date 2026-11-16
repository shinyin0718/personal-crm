import type { Metadata } from "next";
import { googleEnabled } from "@/auth";
import { signup } from "../actions";
import { AuthForm } from "../AuthForm";
import { GoogleButton } from "../GoogleButton";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <AuthForm mode="signup" action={signup} />
      {googleEnabled && <GoogleButton />}
    </>
  );
}
