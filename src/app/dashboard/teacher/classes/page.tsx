import type { Metadata } from "next";
import { BookOpen, Layers3 } from "lucide-react";
import { requireRole } from "@/lib/current-profile";
import { getTeacherDashboard } from "@/lib/dashboard-data";
import { CreateClassroomForm } from "@/components/classrooms/create-classroom-form";
import {
  EmptyClassrooms,
  TeacherClassCard,
} from "@/components/classrooms/classroom-cards";

export const metadata: Metadata = { title: "Classrooms" };

export default async function TeacherClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ create?: string }>;
}) {
  const [profile, query] = await Promise.all([
    requireRole("TEACHER"),
    searchParams,
  ]);
  const data = await getTeacherDashboard(profile.teacher!.id);

  return (
    <div className="space-y-7">
      <section className="flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-extrabold text-brand-600">
            <Layers3 className="size-4" />
            Classroom hub
          </div>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">
            Everything you teach
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Create rooms, manage rosters, and run attendance without an admin queue.
          </p>
        </div>
        <span className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-extrabold text-slate-500 shadow-sm sm:inline-flex">
          <BookOpen className="size-4 text-blue-500" />
          {data.classrooms.length} classroom{data.classrooms.length === 1 ? "" : "s"}
        </span>
      </section>

      {data.classrooms.length === 0 && query.create !== "1" ? (
        <EmptyClassrooms role="teacher" />
      ) : (
        <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          <CreateClassroomForm defaultOpen={query.create === "1"} />
          {data.classrooms.map((classroom, index) => (
            <TeacherClassCard
              key={classroom.id}
              classroom={classroom}
              index={index}
            />
          ))}
        </section>
      )}
    </div>
  );
}
