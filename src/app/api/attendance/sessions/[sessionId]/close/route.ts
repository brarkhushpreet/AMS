import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfile } from "@/lib/current-profile";
import { invalidateCache } from "@/lib/redis";

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

  await db.attendanceSession.update({
    where: { id: sessionId },
    data: { status: "CLOSED", endsAt: new Date() },
  });
  await invalidateCache(
    `dashboard:teacher:${profile.teacher.id}`,
    "dashboard:student:*",
  );
  return NextResponse.json({ success: true });
}
