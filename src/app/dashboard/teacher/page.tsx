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
import { cn, formatDate, formatMethod } from "@/lib/utils";

export default async function TeacherOverviewPage() {
  const profile = await requireRole("TEACHER");
  const data = await getTeacherDashboard(profile.teacher!.id);

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-black/8 bg-[#151a17] p-6 text-white shadow-soft sm:p-8 dark:border-white/8 dark:bg-[#151b18] sm:flex sm:items-end sm:justify-between">
        <div className="pointer-events-none absolute -right-10 -top-20 size-64 rounded-full bg-lime-300/12 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-1/3 size-44 rounded-full bg-cyan-300/8 blur-3xl" />
        <div>
          <p className="editorial-label text-lime-300">Good to see you, {profile.name.split(" ")[0]}</p>
          <h2 className="mt-3 max-w-2xl text-3xl leading-[0.98] font-black tracking-[-0.05em] text-white sm:text-4xl">
            The room is telling
            <span className="font-serif font-normal italic text-white/42"> a story.</span>
          </h2>
          <p className="mt-3 text-sm text-white/42">
            Attendance trends, classroom activity, and live presence at a glance.
          </p>
        </div>
        <Link
          href="/dashboard/teacher/classes?create=1"
          className={cn(
            buttonVariants({ variant: "brand", size: "lg" }),
            "relative mt-6 shrink-0 bg-[#b5f44b] text-[#172008] hover:bg-[#c4ff5d] sm:mt-0 dark:bg-[#b5f44b]",
          )}
        >
          <Plus className="size-4" />
          Create classroom
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
        <article className="rounded-[1.4rem] border border-black/8 bg-[#fbfaf5] p-5 shadow-card sm:p-6 dark:border-white/8 dark:bg-[#151b18]">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="font-black tracking-tight text-slate-950">
                Attendance trend
              </h3>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                Weekly check-in rate over the last eight weeks
              </p>
            </div>
            <StatusPill tone="blue">Last 8 weeks</StatusPill>
          </div>
          <TeacherTrendChart data={data.trend} />
        </article>

        <article className="rounded-[1.4rem] border border-black/8 bg-[#fbfaf5] p-5 shadow-card sm:p-6 dark:border-white/8 dark:bg-[#151b18]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black tracking-tight text-slate-950">
                Recent sessions
              </h3>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                Latest classroom activity
              </p>
            </div>
            <Link href="/dashboard/teacher/attendance" className="text-xs font-extrabold text-brand-600">
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
                  className="flex items-center gap-3 rounded-xl border border-black/6 p-3 hover:border-emerald-700/15 hover:bg-emerald-100/25 dark:border-white/6 dark:hover:border-lime-300/15 dark:hover:bg-lime-300/5"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-300/18 text-violet-700 dark:bg-violet-300/10 dark:text-violet-300">
                    <RadioTower className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-slate-800">
                      {session.classroom}
                    </p>
                    <p className="mt-0.5 truncate text-[0.68rem] font-semibold text-slate-400">
                      {formatMethod(session.method)} · {formatDate(session.startedAt)}
                    </p>
                  </div>
                  <span className="text-xs font-black text-slate-600">
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
            <h3 className="text-lg font-black tracking-tight text-slate-950">
              Your classrooms
            </h3>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              Open a room to manage the roster or start attendance.
            </p>
          </div>
          <Link href="/dashboard/teacher/classes" className="text-xs font-extrabold text-emerald-700 dark:text-lime-300">
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
    <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm font-semibold text-slate-400">
      {text}
    </div>
  );
}
