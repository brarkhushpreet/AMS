"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  loginSchema,
  signupSchema,
  type AuthActionState,
} from "@/lib/validation";

function formValues(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function loginAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await signIn("credentials", {
      ...parsed.data,
      email: parsed.data.email.toLowerCase(),
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email or password is incorrect." };
    }
    throw error;
  }

  return {};
}

export async function signupAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return {
      error: "Please check your details.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const values = parsed.data;
  const email = values.email.trim().toLowerCase();

  const exists = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) return { error: "An account already exists for this email." };

  const password = await bcrypt.hash(values.password, 12);

  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: values.name,
        email,
        password,
        role: values.role,
      },
    });

    if (values.role === "TEACHER") {
      await tx.teacher.create({
        data: {
          userId: user.id,
          department: values.department || null,
        },
      });
      return;
    }

    const student = await tx.student.create({
      data: {
        userId: user.id,
        department: values.department || null,
        registrationNumber: values.registrationNumber!,
        className: values.className || null,
        batch: values.batch || null,
      },
    });

    const invitations = await tx.classroomInvitation.findMany({
      where: {
        email,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      select: { id: true, classroomId: true },
    });

    if (invitations.length > 0) {
      await tx.enrollment.createMany({
        data: invitations.map((invite) => ({
          studentId: student.id,
          classroomId: invite.classroomId,
        })),
        skipDuplicates: true,
      });
      await tx.classroomInvitation.updateMany({
        where: { id: { in: invitations.map((invite) => invite.id) } },
        data: { status: "ACCEPTED" },
      });
    }
  });

  try {
    await signIn("credentials", {
      email,
      password: values.password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: "Account created. You can now sign in." };
    }
    throw error;
  }

  return {};
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
