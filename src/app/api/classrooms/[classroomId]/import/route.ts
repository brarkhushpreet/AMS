import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireProfile } from "@/lib/current-profile";
import { invalidateCache } from "@/lib/redis";

const rowSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email(),
  registrationNumber: z.string().trim().max(80).optional().default(""),
  department: z.string().trim().max(100).optional().default(""),
  className: z.string().trim().max(80).optional().default(""),
  batch: z.string().trim().max(80).optional().default(""),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ classroomId: string }> },
) {
  const profile = await requireProfile();
  const { classroomId } = await context.params;
  if (profile.role !== "TEACHER" || !profile.teacher) {
    return NextResponse.json({ error: "Teacher access required." }, { status: 403 });
  }

  const classroom = await db.classroom.findFirst({
    where: { id: classroomId, teacherId: profile.teacher.id },
    select: { id: true },
  });
  if (!classroom) {
    return NextResponse.json({ error: "Classroom not found." }, { status: 404 });
  }

  const body = (await request.json()) as { rows?: unknown[] };
  if (!Array.isArray(body.rows) || body.rows.length === 0 || body.rows.length > 500) {
    return NextResponse.json(
      { error: "Upload between 1 and 500 students at a time." },
      { status: 400 },
    );
  }

  const validRows: Array<z.infer<typeof rowSchema>> = [];
  const rejected: Array<{ row: number; message: string }> = [];
  body.rows.forEach((row, index) => {
    const result = rowSchema.safeParse(row);
    if (result.success) {
      validRows.push({ ...result.data, email: result.data.email.toLowerCase() });
    } else {
      rejected.push({
        row: index + 2,
        message: result.error.issues[0]?.message ?? "Invalid row",
      });
    }
  });

  let enrolled = 0;
  let invited = 0;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.$transaction(async (tx) => {
    for (const row of validRows) {
      const existing = await tx.user.findUnique({
        where: { email: row.email },
        include: { student: { select: { id: true } } },
      });

      if (existing?.student) {
        await tx.enrollment.upsert({
          where: {
            studentId_classroomId: {
              studentId: existing.student.id,
              classroomId,
            },
          },
          update: {},
          create: {
            studentId: existing.student.id,
            classroomId,
          },
        });
        enrolled += 1;
        continue;
      }

      await tx.classroomInvitation.upsert({
        where: { classroomId_email: { classroomId, email: row.email } },
        update: {
          ...row,
          registrationNumber: row.registrationNumber || null,
          department: row.department || null,
          className: row.className || null,
          batch: row.batch || null,
          status: "PENDING",
          expiresAt,
        },
        create: {
          ...row,
          classroomId,
          registrationNumber: row.registrationNumber || null,
          department: row.department || null,
          className: row.className || null,
          batch: row.batch || null,
          expiresAt,
        },
      });
      invited += 1;
    }
  });

  await invalidateCache(
    `dashboard:teacher:${profile.teacher.id}`,
    "dashboard:student:*",
  );
  return NextResponse.json({ enrolled, invited, rejected });
}
