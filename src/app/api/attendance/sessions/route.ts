import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfile } from "@/lib/current-profile";
import { attendanceSessionSchema } from "@/lib/validation";
import { invalidateCache } from "@/lib/redis";
import {
  appendAttendanceEventTx,
  auditActorId,
  generateAttendanceReport,
} from "@/lib/audit";

export async function POST(request: Request) {
  const profile = await requireProfile();
  if (profile.role !== "TEACHER" || !profile.teacher) {
    return NextResponse.json({ error: "Teacher access required." }, { status: 403 });
  }

  const parsed = attendanceSessionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the session settings.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const values = parsed.data;
  if (
    values.method === "GEOLOCATION" &&
    (values.latitude === undefined ||
      values.longitude === undefined ||
      values.radiusMeters === undefined)
  ) {
    return NextResponse.json(
      { error: "Location and room radius are required." },
      { status: 400 },
    );
  }

  const classroom = await db.classroom.findFirst({
    where: { id: values.classroomId, teacherId: profile.teacher.id },
    select: { id: true },
  });
  if (!classroom) {
    return NextResponse.json({ error: "Classroom not found." }, { status: 404 });
  }

  const now = new Date();
  const endsAt = new Date(now.getTime() + values.durationMinutes * 60_000);

  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Classroom" WHERE "id" = ${values.classroomId} FOR UPDATE`;
    const superseded = await tx.attendanceSession.findMany({
      where: { classroomId: values.classroomId, status: "ACTIVE" },
      select: { id: true },
    });
    await tx.attendanceSession.updateMany({
      where: { classroomId: values.classroomId, status: "ACTIVE" },
      data: { status: "CLOSED", endsAt: now },
    });
    for (const previous of superseded) {
      await appendAttendanceEventTx(tx, {
        sessionId: previous.id,
        type: "SESSION_CLOSED",
        actorId: auditActorId(profile.id),
        payload: { reason: "SUPERSEDED_BY_NEW_SESSION" },
        createdAt: now,
      });
    }
    const created = await tx.attendanceSession.create({
      data: {
        classroomId: values.classroomId,
        method: values.method,
        endsAt,
        latitude: values.method === "GEOLOCATION" ? values.latitude : null,
        longitude: values.method === "GEOLOCATION" ? values.longitude : null,
        radiusMeters: values.method === "GEOLOCATION" ? values.radiusMeters : null,
        frequencyMinHz: values.method === "ULTRASOUND" ? 17_200 : null,
        frequencyMaxHz: values.method === "ULTRASOUND" ? 18_800 : null,
        frequencyIntervalMs: values.method === "ULTRASOUND" ? 1_100 : null,
        minFrequencyMatches: values.method === "ULTRASOUND" ? 4 : null,
      },
    });
    await appendAttendanceEventTx(tx, {
      sessionId: created.id,
      type: "SESSION_STARTED",
      actorId: auditActorId(profile.id),
      payload: {
        classroomId: values.classroomId,
        method: values.method,
        durationMinutes: values.durationMinutes,
        protocolVersion: 2,
        acousticPolicy:
          values.method === "ULTRASOUND"
            ? {
                expectedFrequencyDisclosure: false,
                frequencyMinHz: 17_200,
                frequencyMaxHz: 18_800,
                frequencyIntervalMs: 1_100,
                minFrequencyMatches: 4,
              }
            : null,
      },
    });
    return {
      session: created,
      supersededIds: superseded.map((item) => item.id),
    };
  });
  await Promise.allSettled(
    result.supersededIds.map((sessionId) =>
      generateAttendanceReport(sessionId),
    ),
  );

  await invalidateCache(
    `dashboard:teacher:${profile.teacher.id}`,
    "dashboard:student:*",
  );
  return NextResponse.json(
    { session: result.session },
    { status: 201 },
  );
}
