import Link from "next/link";
import {
  BookOpen,
  CalendarCheck2,
  Plus,
  RadioTower,
  UsersRound,
} from "lucide-react";
import { requireRole } from "@/lib/current-profile";
import { getTeacherDashboard } from "@/lib/dashboard-data";
import { MetricCard } from "@/components/dashboard/metric-card";
import { TeacherTrendChart } from "@/components/dashboard/analytics-charts";
import { StatusPill } from "@/components/ui/status-pill";
import { buttonVariants } from "@/components/ui/button";
import {
  EmptyClassrooms,
  TeacherClassCard,
} from "@/components/classrooms/classroom-cards";
import { formatDate, formatMethod } from "@/lib/utils";

export default async function TeacherOverviewPage() {
  const profile = await requireRole("TEACHER");
  const data = await getTeacherDashboard(profile.teacher!.id);

  return (
    <div className="space-y-7">
      <section className="flex flex-col justify-between gap-5 border-b border-[var(--border)] pb-7 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-sm text-[var(--muted)]">Welcome back, {profile.name.split(" ")[0]}</p>
          <h2 className="text-3xl font-semibold tracking-[-.04em] text-[var(--foreground)]">Your teaching workspace</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">A clear view of your classrooms, recent sessions, and participation.</p>
        </div>
        <Link href="/dashboard/teacher/classes?create=1" className={buttonVariants({ variant: "brand" })}>
          <Plus className="size-4" /> Create classroom
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Classrooms"
          value={data.summary.classrooms}
          detail="Teacher-owned workspaces"
          icon={BookOpen}
          tone="blue"
        />
        <MetricCard
          label="Students"
          value={data.summary.students}
          detail="Unique students enrolled"
          icon={UsersRound}
          tone="violet"
        />
        <MetricCard
          label="Sessions"
          value={data.summary.sessions}
          detail="Attendance sessions run"
          icon={CalendarCheck2}
          tone="amber"
        />
        <MetricCard
          label="Attendance"
          value={`${data.summary.rate}%`}
          detail="Across all your classrooms"
          icon={RadioTower}
          tone="emerald"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_0.75fr]">
        <article className="rounded-xl border border-black/8 bg-[var(--surface)] p-5 shadow-card sm:p-6 dark:border-white/8 dark:bg-[var(--surface)]">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold tracking-tight text-slate-950">
                Attendance trend
              </h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Weekly check-in rate over the last eight weeks
              </p>
            </div>
            <StatusPill tone="blue">Last 8 weeks</StatusPill>
          </div>
          <TeacherTrendChart data={data.trend} />
        </article>

        <article className="rounded-xl border border-black/8 bg-[var(--surface)] p-5 shadow-card sm:p-6 dark:border-white/8 dark:bg-[var(--surface)]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold tracking-tight text-slate-950">
                Recent sessions
              </h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Latest classroom activity
              </p>
            </div>
            <Link href="/dashboard/teacher/attendance" className="text-xs font-semibold text-brand-600">
              View all
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {data.recent.length === 0 ? (
              <EmptyLine text="Your sessions will appear here." />
            ) : (
              data.recent.slice(0, 5).map((session) => (
                <Link
                  key={session.id}
                  href={`/dashboard/teacher/classes/${session.classroomId}`}
                  className="flex items-center gap-3 rounded-xl border border-black/6 p-3 hover:border-emerald-700/15 hover:bg-emerald-100/25 dark:border-white/6 dark:hover:border-blue-300/15 dark:hover:bg-blue-300/5"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-300/18 text-violet-700 dark:bg-violet-300/10 dark:text-violet-300">
                    <RadioTower className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {session.classroom}
                    </p>
                    <p className="mt-0.5 truncate text-[0.68rem] font-semibold text-slate-500">
                      {formatMethod(session.method)} · {formatDate(session.startedAt)}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-slate-600">
                    {session.present}/{session.total}
                  </span>
                </Link>
              ))
            )}
          </div>
        </article>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-slate-950">
              Your classrooms
            </h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Open a room to manage the roster or start attendance.
            </p>
          </div>
          <Link href="/dashboard/teacher/classes" className="text-xs font-semibold text-emerald-700 dark:text-blue-300">
            See all
          </Link>
        </div>
        {data.classrooms.length === 0 ? (
          <EmptyClassrooms role="teacher" />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {data.classrooms.slice(0, 6).map((classroom, index) => (
              <TeacherClassCard key={classroom.id} classroom={classroom} index={index} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm font-semibold text-slate-500">
      {text}
    </div>
  );
}
