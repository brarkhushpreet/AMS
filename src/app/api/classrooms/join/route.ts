import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfile } from "@/lib/current-profile";
import { joinClassroomSchema } from "@/lib/validation";
import { invalidateCache } from "@/lib/redis";

export async function POST(request: Request) {
  const profile = await requireProfile();
  if (profile.role !== "STUDENT" || !profile.student) {
    return NextResponse.json({ error: "Student access required." }, { status: 403 });
  }

  const parsed = joinClassroomSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid classroom code." }, { status: 400 });
  }

  const classroom = await db.classroom.findUnique({
    where: { joinCode: parsed.data.joinCode.toUpperCase() },
    select: { id: true, name: true },
  });
  if (!classroom) {
    return NextResponse.json({ error: "That classroom code was not found." }, { status: 404 });
  }

  await db.enrollment.upsert({
    where: {
      studentId_classroomId: {
        studentId: profile.student.id,
        classroomId: classroom.id,
      },
    },
    update: {},
    create: {
      studentId: profile.student.id,
      classroomId: classroom.id,
    },
  });

  await db.classroomInvitation.updateMany({
    where: {
      classroomId: classroom.id,
      email: profile.email,
      status: "PENDING",
    },
    data: { status: "ACCEPTED" },
  });

  await invalidateCache(
    `dashboard:student:${profile.student.id}`,
    `dashboard:teacher:*`,
  );
  return NextResponse.json({ classroom });
}
