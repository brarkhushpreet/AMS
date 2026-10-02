import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const profile = await currentProfile();
  if (profile?.role !== "STUDENT" || !profile.student) {
    return NextResponse.json({ error: "Student access required." }, { status: 403 });
  }

  const classroomId = new URL(request.url).searchParams.get("classroomId");
  const sessions = await db.attendanceSession.findMany({
    where: {
      status: "ACTIVE",
      endsAt: { gt: new Date() },
      ...(classroomId ? { classroomId } : {}),
      classroom: { enrollments: { some: { studentId: profile.student.id } } },
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  return NextResponse.json(
    { sessionIds: sessions.map((session) => session.id) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
