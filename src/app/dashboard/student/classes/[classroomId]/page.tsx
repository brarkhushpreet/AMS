import type { Metadata } from "next";
import { ClassroomBanner } from "@/components/classrooms/classroom-banner";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  CalendarCheck2,
  RadioTower,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/current-profile";
import { attendanceRate } from "@/lib/attendance-utils";
import { MetricCard } from "@/components/dashboard/metric-card";
import { AttendanceFilters } from "@/components/attendance/attendance-filters";
import { Pagination } from "@/components/ui/pagination";
import { StatusPill } from "@/components/ui/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatDate, formatMethod } from "@/lib/utils";

export const metadata: Metadata = { title: "Classroom" };

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

export default async function StudentClassroomPage({
  params,
  searchParams,
}: {
  params: Promise<{ classroomId: string }>;
  searchParams: SearchParams;
}) {
  const [profile, { classroomId }, query] = await Promise.all([
    requireRole("STUDENT"),
    params,
    searchParams,
  ]);
  const enrollment = await db.enrollment.findUnique({
    where: {
      studentId_classroomId: {
        studentId: profile.student!.id,
        classroomId,
      },
    },
    include: {
      classroom: {
        include: {
          teacher: { include: { user: { select: { name: true } } } },
          attendanceSessions: {
            include: {
              attendanceRecords: {
                where: { studentId: profile.student!.id },
              },
            },
            orderBy: { startedAt: "desc" },
          },
        },
      },
    },
  });
  if (!enrollment) notFound();

  const classroom = enrollment.classroom;
  const active = classroom.attendanceSessions.find(
    (session) => session.status === "ACTIVE" && session.endsAt > new Date(),
  );
  const attended = classroom.attendanceSessions.filter(
    (session) => session.attendanceRecords.length > 0,
  ).length;
  const rate = attendanceRate(attended, classroom.attendanceSessions.length);
  const method = valueOf(query.method);
  const status = valueOf(query.status);
  const period = valueOf(query.period);
  const startedAfter = periodStart(period);
  const now = new Date();
  const filteredSessions = classroom.attendanceSessions.filter((session) => {
    const present = session.attendanceRecords.length > 0;
    const live = session.status === "ACTIVE" && session.endsAt > now;

    if (method && session.method !== method) return false;
    if (startedAfter && session.startedAt < startedAfter) return false;
    if (status === "PRESENT" && !present) return false;
    if (status === "ABSENT" && (present || session.status !== "CLOSED")) return false;
    if (status === "LIVE" && !live) return false;
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
      <Link href="/dashboard/student/classes" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-950">
        <ArrowLeft className="size-3.5" />
        My classrooms
      </Link>
      <ClassroomBanner>
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <StatusPill tone="blue">{classroom.subjectCode}</StatusPill>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">{classroom.name}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {classroom.teacher.user.name} · {classroom.academicTerm}
            </p>
          </div>
          {active ? (
            <Link
              href={`/dashboard/student/sessions/${active.id}`}
              className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "border-white/20 bg-white text-slate-950")}
            >
              <RadioTower className="size-4 text-emerald-600" />
              Check in now
            </Link>
          ) : (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
              No live check-in
            </div>
          )}
        </div>
      </ClassroomBanner>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Attendance" value={`${rate}%`} detail={rate >= 75 ? "You are on track" : "Below the recommended 75%"} icon={BarChart3} tone={rate >= 75 ? "emerald" : "amber"} />
        <MetricCard label="Attended" value={attended} detail="Verified sessions" icon={CalendarCheck2} tone="blue" />
        <MetricCard label="Sessions" value={classroom.attendanceSessions.length} detail="Held by your teacher" icon={RadioTower} tone="violet" />
        <MetricCard label="Teacher" value={classroom.teacher.user.name.split(" ")[0]} detail={classroom.subjectCode} icon={UserRound} tone="amber" />
      </section>

      <AttendanceFilters
        showSearch={false}
        showClassroom={false}
        statusOptions={[
          { value: "all", label: "Every outcome" },
          { value: "PRESENT", label: "Present" },
          { value: "ABSENT", label: "Absent" },
          { value: "LIVE", label: "Live now" },
        ]}
        current={{ method, status, period }}
        resultCount={filteredSessions.length}
      />

      <section className="overflow-hidden rounded-2xl border border-black/8 bg-[var(--surface)] shadow-card dark:border-white/8 dark:bg-[var(--surface)]">
        <div className="border-b border-black/6 px-5 py-4 dark:border-white/7">
          <h3 className="font-semibold text-slate-950 dark:text-white">Session history</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-white/60">
            Every attendance session for this classroom
          </p>
        </div>
        {filteredSessions.length === 0 ? (
          <p className="p-10 text-center text-sm font-semibold text-slate-500">No sessions have been held yet.</p>
        ) : (
          <div className="divide-y divide-black/6 dark:divide-white/7">
            {pageSessions.map((session) => {
              const present = session.attendanceRecords.length > 0;
              const live =
                session.status === "ACTIVE" && session.endsAt > now;
              return (
                <div key={session.id} className="flex items-center gap-4 px-5 py-4">
                  <span className={cn("grid size-9 place-items-center rounded-xl", session.method === "GEOLOCATION" ? "bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300" : "bg-violet-50 text-violet-600 dark:bg-violet-400/10 dark:text-violet-300")}>
                    <RadioTower className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white/85">{formatDate(session.startedAt)}</p>
                    <p className="mt-0.5 text-[0.68rem] font-semibold text-slate-500 dark:text-white/60">{formatMethod(session.method)}</p>
                  </div>
                  {live && !present ? (
                    <Link href={`/dashboard/student/sessions/${session.id}`} className="text-xs font-semibold text-brand-600">Check in</Link>
                  ) : (
                    <div className="flex items-center gap-2">
                      <StatusPill tone={present ? "green" : "red"}>{present ? "PRESENT" : "ABSENT"}</StatusPill>
                      <Link
                        href={`/dashboard/sessions/${session.id}/receipt`}
                        aria-label="Open verified receipt"
                        className="grid size-8 place-items-center rounded-xl border border-black/8 text-emerald-700 dark:border-white/8 dark:text-blue-300"
                      >
                        <ShieldCheck className="size-3.5" />
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <Pagination
          basePath={`/dashboard/student/classes/${classroom.id}`}
          currentPage={page}
          totalPages={totalPages}
          params={{ method, status, period }}
        />
      </section>
    </div>
  );
}
