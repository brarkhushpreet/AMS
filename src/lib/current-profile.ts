import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/client";

export const currentProfile = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;

  return db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      attendancePasskeyRequired: true,
      student: { select: { id: true } },
      teacher: { select: { id: true } },
    },
  });
});

export async function requireProfile() {
  const profile = await currentProfile();
  if (!profile) redirect("/auth/login");
  return profile;
}

export async function requireRole(role: Role) {
  const profile = await requireProfile();
  if (profile.role !== role) redirect("/dashboard");
  return profile;
}
