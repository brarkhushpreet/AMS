import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfile } from "@/lib/current-profile";
import { createRealtimeTicket } from "@/lib/realtime-ticket";

export async function GET(request: Request) {
  const profile = await requireProfile();
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "Session is required." }, { status: 400 });
  }

  const session = await db.attendanceSession.findUnique({
    where: { id: sessionId },
    include: {
      classroom: {
        include: {
          enrollments: {
            where: { studentId: profile.student?.id },
            select: { id: true },
          },
        },
      },
    },
  });

  if (
    !session ||
    session.status !== "ACTIVE" ||
    session.endsAt <= new Date() ||
    session.method !== "ULTRASOUND"
  ) {
    return NextResponse.json({ error: "This live session is no longer available." }, { status: 404 });
  }

  const canJoin =
    (profile.role === "TEACHER" &&
      session.classroom.teacherId === profile.teacher?.id) ||
    (profile.role === "STUDENT" &&
      session.classroom.enrollments.length > 0);

  if (!canJoin) {
    return NextResponse.json({ error: "You do not have access to this session." }, { status: 403 });
  }

  return NextResponse.json({
    ticket: createRealtimeTicket({
      userId: profile.id,
      role: profile.role,
      sessionId,
      classroomId: session.classroomId,
      sessionEndsAt: session.endsAt.getTime(),
    }),
    settings: {
      minHz: session.frequencyMinHz,
      maxHz: session.frequencyMaxHz,
      intervalMs: session.frequencyIntervalMs,
      matchesRequired: session.minFrequencyMatches,
      endsAt: session.endsAt.toISOString(),
    },
  });
}
