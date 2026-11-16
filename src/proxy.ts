import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

export { auth as proxy };

export const config = {
  matcher: [
    "/((?!api/auth|api/files|api/oauth|api/mcp|api/well-known|\\.well-known|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/).*)",
  ],
};
