import NextAuth from "next-auth";
import type { Role } from "@/generated/prisma/client";
import authConfig from "@/lib/auth.config";

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role as Role;
      }
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
});
