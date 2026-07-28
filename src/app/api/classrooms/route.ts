import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfile } from "@/lib/current-profile";
import { classroomSchema } from "@/lib/validation";
import { createJoinCode } from "@/lib/attendance-utils";
import { invalidateCache } from "@/lib/redis";

export async function POST(request: Request) {
  const profile = await requireProfile();
  if (profile.role !== "TEACHER" || !profile.teacher) {
    return NextResponse.json({ error: "Teacher access required." }, { status: 403 });
  }

  const parsed = classroomSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the classroom details.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const duplicate = await db.classroom.findUnique({
    where: {
      teacherId_subjectCode_academicTerm: {
        teacherId: profile.teacher.id,
        subjectCode: parsed.data.subjectCode.toUpperCase(),
        academicTerm: parsed.data.academicTerm,
      },
    },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "You already have this subject in the selected term." },
      { status: 409 },
    );
  }

  let joinCode = createJoinCode();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const exists = await db.classroom.findUnique({
      where: { joinCode },
      select: { id: true },
    });
    if (!exists) break;
    joinCode = createJoinCode();
  }

  const classroom = await db.classroom.create({
    data: {
      ...parsed.data,
      subjectCode: parsed.data.subjectCode.toUpperCase(),
      section: parsed.data.section || null,
      joinCode,
      teacherId: profile.teacher.id,
    },
  });

  await invalidateCache(`dashboard:teacher:${profile.teacher.id}`);
  return NextResponse.json({ classroom }, { status: 201 });
}
