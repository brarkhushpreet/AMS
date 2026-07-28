import Link from "next/link";
import { ArrowUpRight, BookOpen, Plus } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
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
    "from-cyan-400 to-emerald-400",
    "from-violet-400 to-fuchsia-400",
    "from-lime-400 to-emerald-400",
  ];
  return (
    <Link
      href={`/dashboard/teacher/classes/${classroom.id}`}
      className="group overflow-hidden rounded-[1.4rem] border border-black/8 bg-[#fbfaf5] shadow-card hover:-translate-y-1 hover:border-emerald-700/18 hover:shadow-soft dark:border-white/8 dark:bg-[#151b18] dark:hover:border-lime-300/18"
    >
      <div className={cn("h-1.5 bg-linear-to-r", accents[index % accents.length])} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-black tracking-[0.12em] text-slate-400 uppercase">
              {classroom.code} · {classroom.term}
            </p>
            <h4 className="mt-2 text-lg font-black tracking-tight text-slate-950">
              {classroom.name}
            </h4>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              {classroom.section || "All sections"} · Code {classroom.joinCode}
            </p>
          </div>
          <span className="grid size-9 place-items-center rounded-xl bg-black/4 text-slate-400 group-hover:rotate-6 group-hover:bg-emerald-100 group-hover:text-emerald-700 dark:bg-white/5 dark:text-white/35 dark:group-hover:bg-lime-300/10 dark:group-hover:text-lime-300">
            <ArrowUpRight className="size-4" />
          </span>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-black/6 pt-4 dark:border-white/7">
          <MiniStat label="Students" value={classroom.students} />
          <MiniStat label="Sessions" value={classroom.sessions} />
          <MiniStat label="Attendance" value={`${classroom.rate}%`} />
        </div>
        {classroom.activeSession && (
          <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-100/50 px-3 py-2.5 dark:bg-lime-300/7">
            <StatusPill tone="green" pulse>
              Live now
            </StatusPill>
            <span className="text-[0.68rem] font-bold text-emerald-700">
              {formatMethod(classroom.activeSession.method)}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-base font-black text-slate-800 dark:text-white">{value}</p>
      <p className="mt-0.5 text-[0.62rem] font-bold text-slate-400 dark:text-white/28">{label}</p>
    </div>
  );
}

export function EmptyClassrooms({ role }: { role: "teacher" | "student" }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-[#fbfaf5] p-10 text-center dark:border-white/15 dark:bg-[#151b18]">
      <span className="mx-auto grid size-13 place-items-center rounded-2xl bg-blue-50 text-blue-600">
        <BookOpen className="size-5" />
      </span>
      <h3 className="mt-5 text-lg font-black text-slate-950">
        {role === "teacher" ? "Create your first classroom" : "Join your first classroom"}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
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
