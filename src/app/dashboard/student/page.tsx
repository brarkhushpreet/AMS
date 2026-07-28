import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarCheck2,
  CircleGauge,
  MapPin,
  Plus,
  RadioTower,
  Waves,
} from "lucide-react";
import { requireRole } from "@/lib/current-profile";
import { getStudentDashboard } from "@/lib/dashboard-data";
import { MetricCard } from "@/components/dashboard/metric-card";
import { StudentTrendChart } from "@/components/dashboard/analytics-charts";
import { StatusPill } from "@/components/ui/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { EmptyClassrooms } from "@/components/classrooms/classroom-cards";
import { cn, formatDate, formatMethod } from "@/lib/utils";

export default async function StudentOverviewPage() {
  const profile = await requireRole("STUDENT");
  const data = await getStudentDashboard(profile.student!.id);
  const active = data.classrooms.filter((classroom) => classroom.activeSession);

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-black/8 bg-[#151a17] p-6 text-white shadow-soft sm:flex sm:items-end sm:justify-between sm:p-8 dark:border-white/8 dark:bg-[#151b18]">
        <div className="pointer-events-none absolute -right-10 -top-20 size-64 rounded-full bg-cyan-300/12 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-1/3 size-44 rounded-full bg-violet-300/9 blur-3xl" />
        <div>
          <p className="editorial-label text-cyan-300">
            Welcome back, {profile.name.split(" ")[0]}
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl leading-[0.98] font-black tracking-[-0.05em] text-white sm:text-4xl">
            Your attendance,
            <span className="font-serif font-normal italic text-white/42"> in motion.</span>
          </h2>
          <p className="mt-3 text-sm text-white/42">
            Check in to live sessions and see where every class stands.
          </p>
        </div>
        <Link
          href="/dashboard/student/join"
          className={cn(
            buttonVariants({ variant: "primary", size: "lg" }),
            "relative mt-6 shrink-0 bg-[#b5f44b] text-[#172008] hover:bg-[#c4ff5d] sm:mt-0 dark:bg-[#b5f44b]",
          )}
        >
          <Plus className="size-4" />
          Join classroom
        </Link>
      </section>

      {active.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-linear-to-r from-emerald-50 via-white to-blue-50 p-5 shadow-card">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
              <RadioTower className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <StatusPill tone="green" pulse>
                  Live check-in
                </StatusPill>
                {active.length > 1 && (
                  <span className="text-xs font-bold text-slate-400">
                    +{active.length - 1} more
                  </span>
                )}
              </div>
              <h3 className="mt-2 font-black text-slate-950">
                {active[0].name} is taking attendance
              </h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {formatMethod(active[0].activeSession!.method)} verification · ends{" "}
                {formatDate(active[0].activeSession!.endsAt)}
              </p>
            </div>
            <Link
              href={`/dashboard/student/sessions/${active[0].activeSession!.id}`}
              className={cn(buttonVariants({ variant: "brand" }))}
            >
              Check in now
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Overall rate"
          value={`${data.summary.rate}%`}
          detail="Across all enrolled classes"
          icon={CircleGauge}
          tone="emerald"
        />
        <MetricCard
          label="Attended"
          value={data.summary.attended}
          detail="Verified check-ins"
          icon={CalendarCheck2}
          tone="blue"
        />
        <MetricCard
          label="Total sessions"
          value={data.summary.totalSessions}
          detail="Sessions held so far"
          icon={RadioTower}
          tone="amber"
        />
        <MetricCard
          label="Classrooms"
          value={data.summary.classrooms}
          detail="Currently enrolled"
          icon={BookOpen}
          tone="violet"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
        <article className="rounded-[1.4rem] border border-black/8 bg-[#fbfaf5] p-5 shadow-card sm:p-6 dark:border-white/8 dark:bg-[#151b18]">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="font-black tracking-tight text-slate-950">
                Check-in activity
              </h3>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                Your verified attendance over the last eight weeks
              </p>
            </div>
            <StatusPill tone="blue">Weekly</StatusPill>
          </div>
          <StudentTrendChart data={data.trend} />
        </article>

        <article className="rounded-[1.4rem] border border-black/8 bg-[#fbfaf5] p-5 shadow-card sm:p-6 dark:border-white/8 dark:bg-[#151b18]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black tracking-tight text-slate-950">By classroom</h3>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                Attendance health
              </p>
            </div>
            <Link href="/dashboard/student/classes" className="text-xs font-extrabold text-brand-600">
              View all
            </Link>
          </div>
          <div className="mt-5 space-y-4">
            {data.classrooms.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm font-semibold text-slate-400">
                Join a classroom to see analytics.
              </p>
            ) : (
              data.classrooms.slice(0, 5).map((classroom) => (
                <div key={classroom.id}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-extrabold text-slate-700">
                      {classroom.name}
                    </span>
                    <span className="font-black text-slate-900">{classroom.rate}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        classroom.rate >= 75
                          ? "bg-emerald-500"
                          : classroom.rate >= 60
                            ? "bg-amber-400"
                            : "bg-red-400",
                      )}
                      style={{ width: `${classroom.rate}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h3 className="text-lg font-black tracking-tight text-slate-950">
              My classrooms
            </h3>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              Open a room for its attendance history.
            </p>
          </div>
          <Link href="/dashboard/student/classes" className="text-sm font-extrabold text-brand-600">
            See all
          </Link>
        </div>
        {data.classrooms.length === 0 ? (
          <EmptyClassrooms role="student" />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {data.classrooms.slice(0, 6).map((classroom, index) => (
              <Link
                key={classroom.id}
                href={`/dashboard/student/classes/${classroom.id}`}
                className="group rounded-[1.4rem] border border-black/8 bg-[#fbfaf5] p-5 shadow-card hover:-translate-y-1 hover:border-emerald-700/20 hover:shadow-soft dark:border-white/8 dark:bg-[#151b18] dark:hover:border-lime-300/18"
              >
                <div className="flex items-start justify-between">
                  <span
                    className={cn(
                      "grid size-11 place-items-center rounded-2xl",
                      index % 3 === 0
                        ? "bg-blue-50 text-blue-600"
                        : index % 3 === 1
                          ? "bg-violet-50 text-violet-600"
                          : "bg-emerald-50 text-emerald-600",
                    )}
                  >
                    <BookOpen className="size-5" />
                  </span>
                  {classroom.activeSession && (
                    <StatusPill tone="green" pulse>
                      Live
                    </StatusPill>
                  )}
                </div>
                <p className="mt-5 text-[0.68rem] font-black tracking-[0.12em] text-slate-400 uppercase">
                  {classroom.code} · {classroom.term}
                </p>
                <h4 className="mt-1 text-lg font-black tracking-tight text-slate-950">
                  {classroom.name}
                </h4>
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  {classroom.teacher}
                </p>
                <div className="mt-5 flex items-center gap-4 border-t border-slate-100 pt-4">
                  <div className="relative size-11 rounded-full bg-slate-100">
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: `conic-gradient(#1684e8 ${classroom.rate * 3.6}deg, #e8edf4 0deg)`,
                      }}
                    />
                    <div className="absolute inset-[4px] grid place-items-center rounded-full bg-white text-[0.58rem] font-black dark:bg-[#151b18]">
                      {classroom.rate}%
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-slate-700">
                      {classroom.present} of {classroom.total} attended
                    </p>
                    <p className="mt-1 text-[0.65rem] font-semibold text-slate-400">
                      {classroom.rate >= 75 ? "On track" : "Needs attention"}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {data.recent.length > 0 && (
        <section className="rounded-[1.4rem] border border-black/8 bg-[#fbfaf5] shadow-card dark:border-white/8 dark:bg-[#151b18]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 className="font-black text-slate-950">Recent check-ins</h3>
            <Link href="/dashboard/student/attendance" className="text-xs font-extrabold text-brand-600">
              Full history
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {data.recent.slice(0, 5).map((record) => (
              <div key={record.id} className="flex items-center gap-4 px-5 py-4">
                <span
                  className={cn(
                    "grid size-9 place-items-center rounded-xl",
                    record.method === "GEOLOCATION"
                      ? "bg-blue-50 text-blue-600"
                      : "bg-violet-50 text-violet-600",
                  )}
                >
                  {record.method === "GEOLOCATION" ? (
                    <MapPin className="size-4" />
                  ) : (
                    <Waves className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-slate-800">
                    {record.classroom}
                  </p>
                  <p className="mt-0.5 text-[0.68rem] font-semibold text-slate-400">
                    {formatDate(record.verifiedAt)} · {formatMethod(record.method)}
                  </p>
                </div>
                <StatusPill tone="green">{record.status}</StatusPill>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
