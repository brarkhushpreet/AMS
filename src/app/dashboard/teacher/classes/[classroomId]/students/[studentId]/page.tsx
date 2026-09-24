import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarCheck2,
  CircleGauge,
  Hash,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/current-profile";
import { attendanceRate } from "@/lib/attendance-utils";
import { MetricCard } from "@/components/dashboard/metric-card";
import { StudentDetailChart } from "@/components/dashboard/analytics-charts";
import { AttendanceFilters } from "@/components/attendance/attendance-filters";
import { Pagination } from "@/components/ui/pagination";
import { StatusPill } from "@/components/ui/status-pill";
import { formatDate, initials } from "@/lib/utils";

export const metadata: Metadata = { title: "Student analytics" };

type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function periodStart(period?: string) {
  const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 0;
  if (!days) return null;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

const PAGE_SIZE = 8;

export default async function StudentAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ classroomId: string; studentId: string }>;
  searchParams: SearchParams;
}) {
  const [profile, { classroomId, studentId }, query] = await Promise.all([
    requireRole("TEACHER"),
    params,
    searchParams,
  ]);
  const classroom = await db.classroom.findFirst({
    where: {
      id: classroomId,
      teacherId: profile.teacher!.id,
      enrollments: { some: { studentId } },
    },
    include: {
      attendanceSessions: {
        include: {
          attendanceRecords: {
            where: { studentId },
            select: {
              id: true,
              verifiedAt: true,
              confidence: true,
              deviceVerified: true,
            },
          },
        },
        orderBy: { startedAt: "asc" },
      },
    },
  });
  const student = await db.student.findUnique({
    where: { id: studentId },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!classroom || !student) notFound();

  const attended = classroom.attendanceSessions.filter(
    (session) => session.attendanceRecords.length > 0,
  ).length;
  const rate = attendanceRate(attended, classroom.attendanceSessions.length);
  const chart = classroom.attendanceSessions.slice(-12).map((session) => ({
    session: session.startedAt.toLocaleDateString("en", { month: "short", day: "numeric" }),
    attendance: session.attendanceRecords.length > 0 ? 1 : 0,
  }));
  const method = valueOf(query.method);
  const status = valueOf(query.status);
  const period = valueOf(query.period);
  const startedAfter = periodStart(period);
  const filteredSessions = [...classroom.attendanceSessions]
    .reverse()
    .filter((session) => {
      const present = session.attendanceRecords.length > 0;

      if (method && session.method !== method) return false;
      if (startedAfter && session.startedAt < startedAfter) return false;
      if (status === "PRESENT" && !present) return false;
      if (status === "ABSENT" && (present || session.status !== "CLOSED")) {
        return false;
      }
      return true;
    });
  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / PAGE_SIZE));
  const requestedPage = Number.parseInt(valueOf(query.page) ?? "1", 10);
  const page = Math.min(
    Math.max(Number.isFinite(requestedPage) ? requestedPage : 1, 1),
    totalPages,
  );
  const pageSessions = filteredSessions.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  return (
    <div className="space-y-7">
      <Link href={`/dashboard/teacher/classes/${classroom.id}`} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-950">
        <ArrowLeft className="size-3.5" />
        Back to {classroom.name}
      </Link>
      <section className="flex flex-col justify-between gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-card sm:flex-row sm:items-center sm:p-8">
        <div className="flex items-center gap-4">
          <span className="grid size-16 place-items-center rounded-2xl bg-linear-to-br from-blue-500 to-violet-500 text-lg font-semibold text-white shadow-sm shadow-blue-500/20">
            {initials(student.user.name)}
          </span>
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-brand-600 uppercase">{classroom.subjectCode}</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{student.user.name}</h2>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1.5"><Mail className="size-3" />{student.user.email}</span>
              <span className="flex items-center gap-1.5"><Hash className="size-3" />{student.registrationNumber}</span>
            </div>
          </div>
        </div>
        <StatusPill tone={rate >= 75 ? "green" : rate >= 60 ? "amber" : "red"}>
          {rate >= 75 ? "On track" : "Needs attention"}
        </StatusPill>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Attendance" value={`${rate}%`} detail="In this classroom" icon={CircleGauge} tone={rate >= 75 ? "emerald" : "amber"} />
        <MetricCard label="Attended" value={attended} detail="Verified sessions" icon={CalendarCheck2} tone="blue" />
        <MetricCard label="Missed" value={classroom.attendanceSessions.length - attended} detail="Sessions without check-in" icon={UserRound} tone="violet" />
        <MetricCard label="Total sessions" value={classroom.attendanceSessions.length} detail={classroom.name} icon={CalendarCheck2} tone="amber" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
        <h3 className="font-semibold text-slate-950">Recent attendance pattern</h3>
        <p className="mt-1 text-xs font-semibold text-slate-500">Last 12 sessions in this classroom</p>
        <div className="mt-5">
          <StudentDetailChart data={chart} />
        </div>
      </section>

      <AttendanceFilters
        showSearch={false}
        showClassroom={false}
        statusOptions={[
          { value: "all", label: "Every outcome" },
          { value: "PRESENT", label: "Present" },
          { value: "ABSENT", label: "Absent" },
        ]}
        current={{ method, status, period }}
        resultCount={filteredSessions.length}
      />

      <section className="overflow-hidden rounded-2xl border border-black/8 bg-[var(--surface)] shadow-card dark:border-white/8 dark:bg-[var(--surface)]">
        <div className="border-b border-black/6 px-5 py-4 dark:border-white/7">
          <h3 className="font-semibold text-slate-950 dark:text-white">Session record</h3>
        </div>
        {pageSessions.length === 0 ? (
          <p className="p-10 text-center text-sm font-semibold text-slate-500 dark:text-white/60">
            No attendance records match these filters.
          </p>
        ) : (
        <div className="divide-y divide-black/6 dark:divide-white/7">
          {pageSessions.map((session) => {
            const present = session.attendanceRecords.length > 0;
            return (
              <div key={session.id} className="flex items-center gap-4 px-5 py-4">
                <span className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/6 dark:text-white/60">
                  <CalendarCheck2 className="size-4" />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white/85">{formatDate(session.startedAt)}</p>
                  <p className="mt-0.5 text-[0.68rem] font-semibold text-slate-500 dark:text-white/60">{session.method === "GEOLOCATION" ? "Location" : "Ultrasound"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill
                    tone={present ? "green" : session.status === "ACTIVE" ? "amber" : "red"}
                  >
                    {present ? "PRESENT" : session.status === "ACTIVE" ? "PENDING" : "ABSENT"}
                  </StatusPill>
                  {session.status === "CLOSED" ? (
                    <Link
                      href={`/dashboard/sessions/${session.id}/receipt`}
                      aria-label="Open verified receipt"
                      className="grid size-8 place-items-center rounded-xl border border-black/8 text-emerald-700 dark:border-white/8 dark:text-blue-300"
                    >
                      <ShieldCheck className="size-3.5" />
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        )}
        <Pagination
          basePath={`/dashboard/teacher/classes/${classroom.id}/students/${student.id}`}
          currentPage={page}
          totalPages={totalPages}
          params={{ method, status, period }}
        />
      </section>
    </div>
  );
}
