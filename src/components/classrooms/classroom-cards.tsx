import Link from "next/link";
import { ArrowUpRight, BookOpen, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { getTeacherDashboard } from "@/lib/dashboard-data";
import { cn, formatMethod } from "@/lib/utils";

export function TeacherClassCard({
  classroom,
  index,
}: {
  classroom: Awaited<ReturnType<typeof getTeacherDashboard>>["classrooms"][number];
  index: number;
}) {
  const accents = [
    "bg-blue-500/60",
    "bg-violet-500/60",
    "bg-amber-500/60",
  ];
  return (
    <Link
      href={`/dashboard/teacher/classes/${classroom.id}`}
      className="group block min-w-0 self-start overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] transition-colors hover:border-[var(--accent)]/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
    >
      <div className={cn("h-0.5", accents[index % accents.length])} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[0.625rem] font-medium tracking-[0.08em] text-[var(--muted)] uppercase">
              {classroom.code} · {classroom.term}
            </p>
            <h4 className="mt-2 truncate text-base font-semibold tracking-tight text-[var(--foreground)]" title={classroom.name}>
              {classroom.name}
            </h4>
            <p className="mt-1 truncate text-[0.6875rem] text-[var(--muted)]">
              {classroom.section ? `Section ${classroom.section}` : "All sections"} · {classroom.joinCode}
            </p>
          </div>
          {classroom.activeSession ? (
            <span title={`${formatMethod(classroom.activeSession.method)} session running`} className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--accent-soft)] px-2 py-1 text-[0.625rem] font-medium text-[var(--accent)]">
              <span className="size-1.5 rounded-full bg-current motion-safe:animate-pulse" />
              Live
            </span>
          ) : (
            <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-[var(--muted)] transition-colors group-hover:text-[var(--accent)]" />
          )}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--border)] pt-3">
          <MiniStat label="Students" value={classroom.students} />
          <MiniStat label="Sessions" value={classroom.sessions} />
          <MiniStat label="Attendance" value={`${classroom.rate}%`} />
        </div>
      </div>
    </Link>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-sm font-semibold tabular-nums text-[var(--foreground)]">{value}</p>
      <p className="mt-0.5 text-[0.625rem] text-[var(--muted)]">{label}</p>
    </div>
  );
}

export function EmptyClassrooms({ role }: { role: "teacher" | "student" }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-8 text-center">
      <span className="mx-auto grid size-10 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
        <BookOpen className="size-5" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-[var(--foreground)]">
        {role === "teacher" ? "Create your first classroom" : "Join your first classroom"}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
        {role === "teacher"
          ? "Set up a room, share its code, and start collecting useful attendance data."
          : "Ask your teacher for the classroom code, then join in seconds."}
      </p>
      <Link
        href={
          role === "teacher"
            ? "/dashboard/teacher/classes?create=1"
            : "/dashboard/student/join"
        }
        className={cn(buttonVariants({ variant: "brand" }), "mt-5")}
      >
        <Plus className="size-4" />
        {role === "teacher" ? "Create classroom" : "Join classroom"}
      </Link>
    </div>
  );
}
