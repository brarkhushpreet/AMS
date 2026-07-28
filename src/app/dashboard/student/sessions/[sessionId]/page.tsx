import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/current-profile";
import { StudentCheckin } from "@/components/attendance/student-checkin";

export const metadata: Metadata = { title: "Live check-in" };

export default async function StudentSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const [profile, { sessionId }] = await Promise.all([
    requireRole("STUDENT"),
    params,
  ]);
  const session = await db.attendanceSession.findUnique({
    where: { id: sessionId },
    include: {
      classroom: {
        include: {
          teacher: { include: { user: { select: { name: true } } } },
          enrollments: {
            where: { studentId: profile.student!.id },
            select: { id: true },
          },
        },
      },
      attendanceRecords: {
        where: { studentId: profile.student!.id },
        select: { id: true, verifiedAt: true },
      },
    },
  });
  if (!session || session.classroom.enrollments.length === 0) notFound();

  const alreadyMarked = session.attendanceRecords[0];
  const unavailable =
    session.status !== "ACTIVE" || session.endsAt <= new Date();

  return (
    <div className="mx-auto max-w-xl py-2 sm:py-8">
      <Link
        href={`/dashboard/student/classes/${session.classroomId}`}
        className="mb-5 inline-flex items-center gap-2 text-xs font-extrabold text-slate-500 hover:text-slate-950"
      >
        <ArrowLeft className="size-3.5" />
        Back to classroom
      </Link>
      {alreadyMarked ? (
        <div className="rounded-3xl border border-emerald-200 bg-white p-9 text-center shadow-soft">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="size-7" />
          </span>
          <h2 className="mt-5 text-2xl font-black text-slate-950">Already checked in</h2>
          <p className="mt-2 text-sm text-slate-500">Your attendance for this session is safely recorded.</p>
        </div>
      ) : unavailable ? (
        <div className="rounded-3xl border border-amber-200 bg-white p-9 text-center shadow-soft">
          <h2 className="text-2xl font-black text-slate-950">This check-in has ended</h2>
          <p className="mt-2 text-sm text-slate-500">Ask your teacher if you believe this is a mistake.</p>
        </div>
      ) : (
        <StudentCheckin
          session={{
            id: session.id,
            method: session.method,
            endsAt: session.endsAt.toISOString(),
            classroom: {
              name: session.classroom.name,
              subjectCode: session.classroom.subjectCode,
              teacherName: session.classroom.teacher.user.name,
            },
          }}
        />
      )}
    </div>
  );
}
