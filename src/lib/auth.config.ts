import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/generated/prisma/client";

export default {
  // Keep this configuration database-free: proxy.ts runs in Cloudflare's
  // middleware runtime. Credential providers are added by auth.ts.
  providers: [],
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.role = user.role as Role;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = token.role as Role | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
  },
} satisfies NextAuthConfig;
