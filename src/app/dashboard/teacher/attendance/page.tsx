import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarCheck2,
  MapPin,
  RadioTower,
  ShieldCheck,
  UsersRound,
  Waves,
} from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/current-profile";
import { attendanceRate } from "@/lib/attendance-utils";
import { MetricCard } from "@/components/dashboard/metric-card";
import { AttendanceFilters } from "@/components/attendance/attendance-filters";
import { Pagination } from "@/components/ui/pagination";
import { StatusPill } from "@/components/ui/status-pill";
import { cn, formatDate, formatMethod } from "@/lib/utils";

export const metadata: Metadata = { title: "Attendance" };

const PAGE_SIZE = 8;

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function periodStart(period?: string) {
  const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 0;
  if (!days) return undefined;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1_000);
}

export default async function TeacherAttendancePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [profile, rawParams] = await Promise.all([
    requireRole("TEACHER"),
    searchParams,
  ]);
  const teacherId = profile.teacher!.id;
  const q = first(rawParams.q)?.trim().slice(0, 80);
  const classroom = first(rawParams.classroom);
  const methodValue = first(rawParams.method);
  const method =
    methodValue === "GEOLOCATION" || methodValue === "ULTRASOUND"
      ? methodValue
      : undefined;
  const statusValue = first(rawParams.status);
  const status =
    statusValue === "ACTIVE" || statusValue === "CLOSED"
      ? statusValue
      : undefined;
  const periodValue = first(rawParams.period);
  const period = ["7d", "30d", "90d"].includes(periodValue ?? "")
    ? periodValue
    : undefined;
  const requestedPage = Math.max(1, Number.parseInt(first(rawParams.page) ?? "1", 10) || 1);

  const classroomWhere: Prisma.ClassroomWhereInput = {
    teacherId,
    ...(classroom ? { id: classroom } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { subjectCode: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const filteredWhere: Prisma.AttendanceSessionWhereInput = {
    classroom: classroomWhere,
    ...(method ? { method } : {}),
    ...(status ? { status } : {}),
    ...(periodStart(period) ? { startedAt: { gte: periodStart(period) } } : {}),
  };
  const summaryWhere: Prisma.AttendanceSessionWhereInput = {
    classroom: { teacherId },
  };

  const [classrooms, summarySessions, totalResults] = await Promise.all([
    db.classroom.findMany({
      where: { teacherId },
      orderBy: [{ name: "asc" }, { subjectCode: "asc" }],
      select: { id: true, name: true, subjectCode: true },
    }),
    db.attendanceSession.findMany({
      where: summaryWhere,
      select: {
        status: true,
        endsAt: true,
        _count: { select: { attendanceRecords: true } },
        classroom: {
          select: { _count: { select: { enrollments: true } } },
        },
      },
    }),
    db.attendanceSession.count({ where: filteredWhere }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const sessions = await db.attendanceSession.findMany({
    where: filteredWhere,
    select: {
      id: true,
      classroomId: true,
      method: true,
      status: true,
      startedAt: true,
      endsAt: true,
      _count: { select: { attendanceRecords: true } },
      classroom: {
        select: {
          name: true,
          subjectCode: true,
          _count: { select: { enrollments: true } },
        },
      },
    },
    orderBy: { startedAt: "desc" },
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const marked = summarySessions.reduce(
    (sum, session) => sum + session._count.attendanceRecords,
    0,
  );
  const possible = summarySessions.reduce(
    (sum, session) => sum + session.classroom._count.enrollments,
    0,
  );
  const active = summarySessions.filter(
    (session) => session.status === "ACTIVE" && session.endsAt > new Date(),
  ).length;
  const filterParams = { q, classroom, method, status, period };

  return (
    <div className="space-y-6">
      <section className="border-b border-[var(--border)] pb-6">
        <div>
          <p className="text-sm text-[var(--muted)]">Session archive</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            Attendance, session by session.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Search every classroom, compare verification methods, and isolate the
            sessions that need attention.
          </p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Sessions" value={summarySessions.length} detail="Across every classroom" icon={CalendarCheck2} tone="blue" />
        <MetricCard label="Check-ins" value={marked} detail="Verified attendance records" icon={UsersRound} tone="violet" />
        <MetricCard label="Average" value={`${attendanceRate(marked, possible)}%`} detail="Overall participation rate" icon={RadioTower} tone="emerald" />
        <MetricCard label="Live now" value={active} detail="Currently active sessions" icon={Waves} tone="amber" />
      </section>

      <AttendanceFilters
        classrooms={classrooms.map((item) => ({
          value: item.id,
          label: item.name,
          description: item.subjectCode,
        }))}
        statusOptions={[
          { value: "all", label: "Every status" },
          { value: "ACTIVE", label: "Live sessions" },
          { value: "CLOSED", label: "Closed sessions" },
        ]}
        current={filterParams}
        resultCount={totalResults}
      />

      <section className="overflow-hidden rounded-xl border border-black/8 bg-[var(--surface)] shadow-card dark:border-white/8 dark:bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-black/6 px-5 py-4 dark:border-white/7">
          <div>
            <h3 className="font-semibold text-slate-950 dark:text-white">Session results</h3>
            <p className="mt-1 text-[0.68rem] font-semibold text-slate-500 dark:text-white/60">
              Showing {sessions.length} of {totalResults}
            </p>
          </div>
          <StatusPill tone="neutral">Newest first</StatusPill>
        </div>
        {sessions.length === 0 ? (
          <p className="p-12 text-center text-sm font-semibold text-slate-500">
            No sessions match the selected filters.
          </p>
        ) : (
          <div className="no-scrollbar overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left">
              <thead className="bg-black/[0.025] text-[0.62rem] font-semibold tracking-[0.12em] text-slate-500 uppercase dark:bg-white/[0.025] dark:text-white/60">
                <tr>
                  <th className="px-5 py-3">Classroom</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Check-ins</th>
                  <th className="px-4 py-3">Integrity</th>
                  <th className="px-5 py-3 text-right">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6 dark:divide-white/7">
                {sessions.map((session) => {
                  const rate = attendanceRate(
                    session._count.attendanceRecords,
                    session.classroom._count.enrollments,
                  );
                  return (
                    <tr key={session.id} className="hover:bg-emerald-100/20 dark:hover:bg-blue-300/[0.035]">
                      <td className="px-5 py-4">
                        <Link href={`/dashboard/teacher/classes/${session.classroomId}`} className="font-semibold text-slate-800 hover:text-emerald-700 dark:text-white/80 dark:hover:text-lime-300">
                          {session.classroom.name}
                        </Link>
                        <p className="mt-0.5 text-[0.65rem] font-semibold text-slate-500 dark:text-white/60">{session.classroom.subjectCode}</p>
                      </td>
                      <td className="px-4 py-4 text-xs font-semibold text-slate-500">{formatDate(session.startedAt)}</td>
                      <td className="px-4 py-4">
                        <span className={cn("inline-flex items-center gap-2 text-xs font-semibold", session.method === "GEOLOCATION" ? "text-cyan-700 dark:text-cyan-300" : "text-violet-700 dark:text-violet-300")}>
                          {session.method === "GEOLOCATION" ? <MapPin className="size-3.5" /> : <Waves className="size-3.5" />}
                          {formatMethod(session.method)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs font-bold text-slate-600 dark:text-white/60">
                        {session._count.attendanceRecords}/{session.classroom._count.enrollments}
                      </td>
                      <td className="px-4 py-4">
                        {session.status === "CLOSED" ||
                        session.endsAt <= new Date() ? (
                          <Link
                            href={`/dashboard/sessions/${session.id}/receipt`}
                            className="inline-flex items-center gap-1.5 text-[0.68rem] font-semibold text-emerald-700 hover:text-emerald-900 dark:text-blue-300 dark:hover:text-lime-200"
                          >
                            <ShieldCheck className="size-3.5" />
                            Receipt
                          </Link>
                        ) : (
                          <span className="text-[0.68rem] font-semibold text-slate-300 dark:text-white/18">
                            Seals on close
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <StatusPill tone={rate >= 75 ? "green" : rate >= 60 ? "amber" : "red"}>{rate}%</StatusPill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          basePath="/dashboard/teacher/attendance"
          params={filterParams}
        />
      </section>
    </div>
  );
}
