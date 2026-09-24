import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import authConfig from "@/lib/auth.config";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validation";
import { ensureDemoAccounts } from "@/lib/demo-accounts";
import {
  demoEnabled,
  DEMO_EMAIL_DOMAIN,
  DEMO_STUDENT_ID,
  DEMO_TEACHER_ID,
} from "@/lib/demo-policy";

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const user = await db.user.findUnique({
          where: { email: parsed.data.email.trim().toLowerCase() },
        });
        if (
          !user ||
          user.email.endsWith(`@${DEMO_EMAIL_DOMAIN}`) ||
          !(await bcrypt.compare(parsed.data.password, user.password))
        ) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
    Credentials({
      id: "demo",
      name: "Portfolio demo",
      credentials: { role: { label: "Demo role", type: "text" } },
      async authorize(credentials) {
        if (!demoEnabled() || (credentials.role !== "TEACHER" && credentials.role !== "STUDENT")) return null;
        await ensureDemoAccounts();
        const id = credentials.role === "TEACHER" ? DEMO_TEACHER_ID : DEMO_STUDENT_ID;
        const user = await db.user.findUnique({
          where: { id },
          select: { id: true, name: true, email: true, role: true },
        });
        if (!user || user.role !== credentials.role || !user.email.endsWith(`@${DEMO_EMAIL_DOMAIN}`)) return null;
        return user;
      },
    }),
  ],
});
