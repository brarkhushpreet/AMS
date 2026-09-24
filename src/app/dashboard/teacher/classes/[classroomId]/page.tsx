import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  CalendarCheck2,
  Mail,
  RadioTower,
  UserRound,
  UsersRound,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/current-profile";
import { attendanceRate } from "@/lib/attendance-utils";
import { RosterImport } from "@/components/classrooms/roster-import";
import { SessionControl } from "@/components/attendance/session-control";
import { MetricCard } from "@/components/dashboard/metric-card";
import { StatusPill } from "@/components/ui/status-pill";
import { CopyButton } from "@/components/ui/copy-button";
import { ClassroomBanner } from "@/components/classrooms/classroom-banner";
import { formatDate, formatMethod, initials } from "@/lib/utils";

export const metadata: Metadata = { title: "Classroom" };

export default async function TeacherClassroomPage({
  params,
}: {
  params: Promise<{ classroomId: string }>;
}) {
  const [profile, { classroomId }] = await Promise.all([
    requireRole("TEACHER"),
    params,
  ]);
  const classroom = await db.classroom.findFirst({
    where: { id: classroomId, teacherId: profile.teacher!.id },
    include: {
      enrollments: {
        include: {
          student: {
            include: {
              user: { select: { name: true, email: true } },
              attendanceRecords: {
                where: { session: { classroomId } },
                select: { id: true },
              },
            },
          },
        },
        orderBy: { student: { user: { name: "asc" } } },
      },
      invitations: {
        where: { status: "PENDING", expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      },
      attendanceSessions: {
        include: { attendanceRecords: true },
        orderBy: { startedAt: "desc" },
      },
    },
  });
  if (!classroom) notFound();

  const active =
    classroom.attendanceSessions.find(
      (session) => session.status === "ACTIVE" && session.endsAt > new Date(),
    ) ?? null;
  const marked = classroom.attendanceSessions.reduce(
    (sum, session) => sum + session.attendanceRecords.length,
    0,
  );
  const possible =
    classroom.attendanceSessions.length * classroom.enrollments.length;

  return (
    <div className="space-y-7">
      <Link
        href="/dashboard/teacher/classes"
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-950"
      >
        <ArrowLeft className="size-3.5" />
        All classrooms
      </Link>

      <ClassroomBanner>
        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="blue">{classroom.subjectCode}</StatusPill>
              <span className="text-xs font-bold text-slate-500">
                {classroom.academicTerm} · {classroom.section || "All sections"}
              </span>
            </div>
            <h2 className="mt-4 flex items-center gap-3 text-3xl font-semibold tracking-[-0.04em]">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--banner-border)] bg-[var(--surface)] text-[var(--accent)]"><BookOpen className="size-5" /></span>
              {classroom.name}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {classroom.enrollments.length} enrolled · {classroom.invitations.length} pending invitations
            </p>
          </div>
          <div className="shrink-0 rounded-xl border border-[var(--banner-border)] bg-[var(--surface)] p-4 shadow-sm">
            <p className="text-[0.65rem] font-semibold tracking-[0.13em] text-slate-500 uppercase">
              Join code
            </p>
            <div className="mt-2 flex items-center gap-3">
              <span className="font-mono text-xl font-semibold tracking-[0.16em]">
                {classroom.joinCode}
              </span>
              <CopyButton
                value={classroom.joinCode}
                label="Classroom code"
                successMessage="Classroom code copied"
              />
            </div>
            <p className="mt-2 text-[11px] text-[var(--muted)]">Share with students to join your class</p>
          </div>
        </div>
      </ClassroomBanner>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Students" value={classroom.enrollments.length} detail={`${classroom.invitations.length} invitations pending`} icon={UsersRound} tone="violet" />
        <MetricCard label="Sessions" value={classroom.attendanceSessions.length} detail="Attendance sessions held" icon={CalendarCheck2} tone="blue" />
        <MetricCard label="Attendance" value={`${attendanceRate(marked, possible)}%`} detail="Overall class average" icon={BarChart3} tone="emerald" />
        <MetricCard label="Live now" value={active ? "Yes" : "No"} detail={active ? formatMethod(active.method) : "No active check-in"} icon={RadioTower} tone="amber" />
      </section>

      <section className="grid items-start gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <SessionControl
          classroomId={classroom.id}
          activeSession={
            active
              ? {
                  id: active.id,
                  method: active.method,
                  endsAt: active.endsAt.toISOString(),
                  radiusMeters: active.radiusMeters,
                }
              : null
          }
        />
        <RosterImport classroomId={classroom.id} />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-semibold text-slate-950">Student roster</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Select a student for individual attendance analytics.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {classroom.enrollments.length} enrolled
          </span>
        </div>
        {classroom.enrollments.length === 0 ? (
          <div className="p-10 text-center">
            <UserRound className="mx-auto size-7 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-600">No students yet</p>
            <p className="mt-1 text-xs text-slate-500">Share the join code or import your CSV roster.</p>
          </div>
        ) : (
          <div className="no-scrollbar overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left">
              <thead className="bg-slate-50 text-[0.65rem] font-semibold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-3">Student</th>
                  <th className="px-4 py-3">Registration</th>
                  <th className="px-4 py-3">Class / batch</th>
                  <th className="px-4 py-3">Attendance</th>
                  <th className="px-5 py-3 text-right">Analytics</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classroom.enrollments.map(({ student }) => {
                  const rate = attendanceRate(
                    student.attendanceRecords.length,
                    classroom.attendanceSessions.length,
                  );
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="grid size-9 place-items-center rounded-xl bg-blue-50 text-xs font-semibold text-blue-700">
                            {initials(student.user.name)}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{student.user.name}</p>
                            <p className="mt-0.5 flex items-center gap-1 text-[0.65rem] font-semibold text-slate-500">
                              <Mail className="size-3" />
                              {student.user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs font-bold text-slate-500">{student.registrationNumber}</td>
                      <td className="px-4 py-4 text-xs font-semibold text-slate-500">
                        {[student.className, student.batch].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="px-4 py-4">
                        <StatusPill tone={rate >= 75 ? "green" : rate >= 60 ? "amber" : "red"}>
                          {rate}%
                        </StatusPill>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/dashboard/teacher/classes/${classroom.id}/students/${student.id}`}
                          className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                        >
                          View details
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {classroom.attendanceSessions.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h3 className="font-semibold text-slate-950">Recent sessions</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {classroom.attendanceSessions.slice(0, 6).map((session) => (
              <div key={session.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <div className="flex items-center justify-between">
                  <StatusPill tone={session.method === "GEOLOCATION" ? "blue" : "violet"}>
                    {formatMethod(session.method)}
                  </StatusPill>
                  <span className="text-xs font-semibold text-slate-700">
                    {session.attendanceRecords.length}/{classroom.enrollments.length}
                  </span>
                </div>
                <p className="mt-3 text-xs font-bold text-slate-500">{formatDate(session.startedAt)}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
