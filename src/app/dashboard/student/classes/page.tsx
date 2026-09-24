import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Plus } from "lucide-react";
import { requireRole } from "@/lib/current-profile";
import { getStudentDashboard } from "@/lib/dashboard-data";
import { EmptyClassrooms } from "@/components/classrooms/classroom-cards";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "My classes" };

export default async function StudentClassesPage() {
  const profile = await requireRole("STUDENT");
  const data = await getStudentDashboard(profile.student!.id);

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            My classrooms
          </h2>
          <p className="mt-1.5 text-sm text-[var(--muted)]">
            Attendance details and active check-ins for every enrolled class.
          </p>
        </div>
        <Link
          href="/dashboard/student/join"
          className={buttonVariants({ variant: "brand", size: "sm" })}
        >
          <Plus className="size-3.5" />
          Join classroom
        </Link>
      </section>

      {data.classrooms.length === 0 ? (
        <EmptyClassrooms role="student" />
      ) : (
        <section className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] items-start gap-4" aria-label="Your classrooms">
          {data.classrooms.map((classroom, index) => (
            <Link
              key={classroom.id}
              href={`/dashboard/student/classes/${classroom.id}`}
              className="group block min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--accent)]/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-lg",
                    index % 3 === 0
                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-300"
                      : index % 3 === 1
                        ? "bg-violet-500/10 text-violet-600 dark:text-violet-300"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                  )}
                >
                  <BookOpen className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.625rem] font-medium tracking-[0.08em] text-[var(--muted)] uppercase">
                    {classroom.code} · {classroom.term}
                  </p>
                  <h3 className="mt-1 truncate text-base font-semibold tracking-tight text-[var(--foreground)]" title={classroom.name}>
                    {classroom.name}
                  </h3>
                  <p className="mt-1 truncate text-[0.6875rem] text-[var(--muted)]">
                    {classroom.teacher}
                  </p>
                </div>
                {classroom.activeSession ? (
                  <span title="Live check-in available" className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--accent-soft)] px-2 py-1 text-[0.625rem] font-medium text-[var(--accent)]">
                    <span className="size-1.5 rounded-full bg-current motion-safe:animate-pulse" /> Live
                  </span>
                ) : (
                  <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-[var(--muted)] transition-colors group-hover:text-[var(--accent)]" />
                )}
              </div>
              <div className="mt-4 border-t border-[var(--border)] pt-3">
                <div className="flex items-center justify-between text-[0.6875rem]">
                  <span className="text-[var(--muted)]">Attendance</span>
                  <span className="font-semibold tabular-nums text-[var(--foreground)]">{classroom.rate}%</span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--border)]" role="progressbar" aria-label={`${classroom.name} attendance`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={classroom.rate}>
                  <div
                    className={cn(
                      "h-full rounded-full",
                      classroom.rate >= 75 ? "bg-[var(--accent)]" : "bg-amber-500",
                    )}
                    style={{ width: `${Math.min(100, Math.max(0, classroom.rate))}%` }}
                  />
                </div>
                <p className="mt-2 text-[0.625rem] text-[var(--muted)]">
                  {classroom.present} of {classroom.total} sessions attended
                </p>
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
