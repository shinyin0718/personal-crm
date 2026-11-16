import type { NextAuthConfig } from "next-auth";

const PUBLIC_PATHS = ["/login", "/signup"];

// Edge-safe config shared by the proxy (no database access here).
export const authConfig = {
  pages: { signIn: "/login" },
  // Host header is trusted (Vercel, or a reverse proxy in front of Docker); set AUTH_URL to pin it.
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const loggedIn = Boolean(auth?.user);
      const isPublic = PUBLIC_PATHS.some((p) => nextUrl.pathname.startsWith(p));
      if (isPublic) {
        return loggedIn ? Response.redirect(new URL("/people", nextUrl)) : true;
      }
      return loggedIn;
    },
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
