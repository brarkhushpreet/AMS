import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarCheck2,
  MapPin,
  RadioTower,
  ShieldCheck,
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

export default async function StudentAttendancePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [profile, rawParams] = await Promise.all([
    requireRole("STUDENT"),
    searchParams,
  ]);
  const studentId = profile.student!.id;
  const now = new Date();
  const q = first(rawParams.q)?.trim().slice(0, 80);
  const classroom = first(rawParams.classroom);
  const methodValue = first(rawParams.method);
  const method =
    methodValue === "GEOLOCATION" || methodValue === "ULTRASOUND"
      ? methodValue
      : undefined;
  const statusValue = first(rawParams.status);
  const status = ["PRESENT", "ABSENT", "LIVE"].includes(statusValue ?? "")
    ? statusValue
    : undefined;
  const periodValue = first(rawParams.period);
  const period = ["7d", "30d", "90d"].includes(periodValue ?? "")
    ? periodValue
    : undefined;
  const requestedPage = Math.max(1, Number.parseInt(first(rawParams.page) ?? "1", 10) || 1);

  const classroomWhere: Prisma.ClassroomWhereInput = {
    enrollments: { some: { studentId } },
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
  const recordFilter =
    status === "PRESENT"
      ? { attendanceRecords: { some: { studentId } } }
      : status === "ABSENT"
        ? {
            status: "CLOSED" as const,
            attendanceRecords: { none: { studentId } },
          }
        : status === "LIVE"
          ? {
              status: "ACTIVE" as const,
              endsAt: { gt: now },
            }
          : {};
  const filteredWhere: Prisma.AttendanceSessionWhereInput = {
    classroom: classroomWhere,
    ...(method ? { method } : {}),
    ...(periodStart(period) ? { startedAt: { gte: periodStart(period) } } : {}),
    ...recordFilter,
  };
  const summaryWhere: Prisma.AttendanceSessionWhereInput = {
    classroom: { enrollments: { some: { studentId } } },
  };

  const [classrooms, summarySessions, totalResults] = await Promise.all([
    db.classroom.findMany({
      where: { enrollments: { some: { studentId } } },
      orderBy: [{ name: "asc" }, { subjectCode: "asc" }],
      select: { id: true, name: true, subjectCode: true },
    }),
    db.attendanceSession.findMany({
      where: summaryWhere,
      select: {
        method: true,
        _count: {
          select: { attendanceRecords: { where: { studentId } } },
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
      method: true,
      status: true,
      startedAt: true,
      endsAt: true,
      classroom: { select: { id: true, name: true, subjectCode: true } },
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
    orderBy: { startedAt: "desc" },
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const attended = summarySessions.filter(
    (session) => session._count.attendanceRecords > 0,
  ).length;
  const locationCount = summarySessions.filter(
    (session) =>
      session.method === "GEOLOCATION" &&
      session._count.attendanceRecords > 0,
  ).length;
  const ultrasoundCount = summarySessions.filter(
    (session) =>
      session.method === "ULTRASOUND" &&
      session._count.attendanceRecords > 0,
  ).length;
  const filterParams = { q, classroom, method, status, period };

  return (
    <div className="space-y-6">
      <section className="border-b border-[var(--border)] pb-6">
        <div>
          <p className="text-sm text-[var(--muted)]">Personal archive</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            Every class. Every check-in.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            A transparent, searchable record of where you were present and how
            each check-in was verified.
          </p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Attendance" value={`${attendanceRate(attended, summarySessions.length)}%`} detail="Overall verified rate" icon={RadioTower} tone="emerald" />
        <MetricCard label="Attended" value={attended} detail={`Of ${summarySessions.length} total sessions`} icon={CalendarCheck2} tone="blue" />
        <MetricCard label="Location" value={locationCount} detail="Location-verified check-ins" icon={MapPin} tone="amber" />
        <MetricCard label="Ultrasound" value={ultrasoundCount} detail="Signal-verified check-ins" icon={Waves} tone="violet" />
      </section>

      <AttendanceFilters
        classrooms={classrooms.map((item) => ({
          value: item.id,
          label: item.name,
          description: item.subjectCode,
        }))}
        statusOptions={[
          { value: "all", label: "Every outcome" },
          { value: "PRESENT", label: "Present" },
          { value: "ABSENT", label: "Absent" },
          { value: "LIVE", label: "Live now" },
        ]}
        current={filterParams}
        resultCount={totalResults}
      />

      <section className="overflow-hidden rounded-xl border border-black/8 bg-[var(--surface)] shadow-card dark:border-white/8 dark:bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-black/6 px-5 py-4 dark:border-white/7">
          <div>
            <h3 className="font-semibold text-slate-950 dark:text-white">Attendance results</h3>
            <p className="mt-1 text-[0.68rem] font-semibold text-slate-500 dark:text-white/60">
              Showing {sessions.length} of {totalResults}
            </p>
          </div>
          <StatusPill tone="neutral">Newest first</StatusPill>
        </div>
        {sessions.length === 0 ? (
          <p className="p-12 text-center text-sm font-semibold text-slate-500">
            No attendance records match the selected filters.
          </p>
        ) : (
          <div className="divide-y divide-black/6 dark:divide-white/7">
            {sessions.map((session) => {
              const record = session.attendanceRecords[0];
              const active = session.status === "ACTIVE" && session.endsAt > now;
              return (
                <div key={session.id} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-emerald-100/20 dark:hover:bg-blue-300/[0.035]">
                  <span className={cn("grid size-10 place-items-center rounded-xl", session.method === "GEOLOCATION" ? "bg-cyan-300/18 text-cyan-800 dark:text-cyan-300" : "bg-violet-300/18 text-violet-800 dark:text-violet-300")}>
                    {session.method === "GEOLOCATION" ? <MapPin className="size-4" /> : <Waves className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/dashboard/student/classes/${session.classroom.id}`} className="truncate text-sm font-semibold text-slate-800 hover:text-emerald-700 dark:text-white/80 dark:hover:text-lime-300">
                      {session.classroom.name}
                    </Link>
                    <p className="mt-0.5 text-[0.68rem] font-semibold text-slate-500 dark:text-white/60">
                      {session.classroom.subjectCode} · {formatDate(session.startedAt)} · {formatMethod(session.method)}
                    </p>
                  </div>
                  {active && !record ? (
                    <Link href={`/dashboard/student/sessions/${session.id}`} className="rounded-full bg-[#151a17] px-3 py-2 text-[0.68rem] font-semibold text-white  dark:bg-[var(--accent)] dark:text-[var(--accent-ink)]">
                      Check in now
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2">
                      <StatusPill tone={record ? "green" : "red"}>{record ? "PRESENT" : "ABSENT"}</StatusPill>
                      {record?.deviceVerified ? (
                        <StatusPill tone="violet">
                          Passkey-confirmed
                        </StatusPill>
                      ) : null}
                      <Link
                        href={`/dashboard/sessions/${session.id}/receipt`}
                        aria-label="Open verified attendance receipt"
                        className="grid size-8 place-items-center rounded-xl border border-black/8 text-emerald-700 hover:bg-emerald-50 dark:border-white/8 dark:text-blue-300 dark:hover:bg-blue-300/8"
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
          currentPage={currentPage}
          totalPages={totalPages}
          basePath="/dashboard/student/attendance"
          params={filterParams}
        />
      </section>
    </div>
  );
}
