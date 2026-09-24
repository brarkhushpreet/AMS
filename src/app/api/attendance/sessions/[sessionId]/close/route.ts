import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfile } from "@/lib/current-profile";
import { invalidateCache } from "@/lib/redis";
import { closeAttendance } from "@/lib/attendance-transaction";
import {
  appendAttendanceEventTx,
  auditActorId,
  generateAttendanceReport,
} from "@/lib/audit";

export async function POST(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const profile = await requireProfile();
  const { sessionId } = await context.params;
  if (profile.role !== "TEACHER" || !profile.teacher) {
    return NextResponse.json({ error: "Teacher access required." }, { status: 403 });
  }

  const session = await db.attendanceSession.findFirst({
    where: {
      id: sessionId,
      classroom: { teacherId: profile.teacher.id },
    },
    select: { id: true },
  });
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const closedAt = new Date();
  await db.$transaction(async (tx) => {
    const closed = await closeAttendance(tx, sessionId, closedAt);
    if (closed.count) {
      await appendAttendanceEventTx(tx, {
        sessionId,
        type: "SESSION_CLOSED",
        actorId: auditActorId(profile.id),
        payload: { reason: "TEACHER_ENDED" },
        createdAt: closedAt,
      });
    }
  });
  const report = await generateAttendanceReport(sessionId);
  await invalidateCache(
    `dashboard:teacher:${profile.teacher.id}`,
    "dashboard:student:*",
  );
  return NextResponse.json({ success: true, reportId: report.id });
}
