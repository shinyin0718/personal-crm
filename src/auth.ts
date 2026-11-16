import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { isEmailAllowed } from "@/lib/limits";
import { clearLoginAttempts, clientIp, reserveLoginAttempt } from "@/lib/login-limit";
import { credentialsSchema } from "@/lib/validation";
import { authConfig } from "./auth.config";

export const googleEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

class RateLimited extends CredentialsSignin {
  code = "rate_limited";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // The adapter is typed against the default @prisma/client output.
  adapter: PrismaAdapter(prisma as unknown as Parameters<typeof PrismaAdapter>[0]),
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const reserved = await reserveLoginAttempt(email, clientIp(request.headers));
        if (!reserved) throw new RateLimited();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        if (!(await bcrypt.compare(password, user.passwordHash))) return null;
        await clearLoginAttempts(email, reserved);
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
    ...(googleEnabled ? [Google] : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Google is how new accounts are made, so it must respect SIGNUP_ALLOWLIST for new emails.
    async signIn({ account, profile, user }) {
      if (account?.provider !== "google") return true;
      const email = user.email?.toLowerCase();
      if (!email || profile?.email_verified !== true) return false;
      if (isEmailAllowed(email)) return true;
      return Boolean(await prisma.user.findUnique({ where: { email }, select: { id: true } }));
    },
  },
});
