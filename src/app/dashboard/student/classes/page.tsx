import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Plus } from "lucide-react";
import { requireRole } from "@/lib/current-profile";
import { getStudentDashboard } from "@/lib/dashboard-data";
import { EmptyClassrooms } from "@/components/classrooms/classroom-cards";
import { StatusPill } from "@/components/ui/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "My classes" };

export default async function StudentClassesPage() {
  const profile = await requireRole("STUDENT");
  const data = await getStudentDashboard(profile.student!.id);

  return (
    <div className="space-y-7">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-extrabold text-brand-600">Your learning spaces</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">
            My classrooms
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Attendance details and active check-ins for every enrolled class.
          </p>
        </div>
        <Link
          href="/dashboard/student/join"
          className={cn(buttonVariants({ variant: "brand" }))}
        >
          <Plus className="size-4" />
          Join classroom
        </Link>
      </section>

      {data.classrooms.length === 0 ? (
        <EmptyClassrooms role="student" />
      ) : (
        <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {data.classrooms.map((classroom, index) => (
            <Link
              key={classroom.id}
              href={`/dashboard/student/classes/${classroom.id}`}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-card hover:-translate-y-1 hover:border-blue-200 hover:shadow-soft"
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
                {classroom.activeSession ? (
                  <StatusPill tone="green" pulse>Live check-in</StatusPill>
                ) : (
                  <ArrowUpRight className="size-4 text-slate-300 group-hover:text-blue-500" />
                )}
              </div>
              <p className="mt-5 text-[0.68rem] font-black tracking-[0.12em] text-slate-400 uppercase">
                {classroom.code} · {classroom.term}
              </p>
              <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                {classroom.name}
              </h3>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                {classroom.teacher}
              </p>
              <div className="mt-5 rounded-xl bg-slate-50 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-500">Attendance</span>
                  <span className="font-black text-slate-800">{classroom.rate}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      classroom.rate >= 75 ? "bg-emerald-500" : "bg-amber-400",
                    )}
                    style={{ width: `${classroom.rate}%` }}
                  />
                </div>
                <p className="mt-2 text-[0.65rem] font-semibold text-slate-400">
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
