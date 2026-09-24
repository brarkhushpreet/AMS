import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";
import { requireRole } from "@/lib/current-profile";
import { getTeacherDashboard } from "@/lib/dashboard-data";
import { CreateClassroomForm } from "@/components/classrooms/create-classroom-form";
import { buttonVariants } from "@/components/ui/button";
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
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Classrooms
          </h2>
          <p className="mt-1.5 text-sm text-[var(--muted)]">
            Manage your rooms, student rosters, and attendance sessions.
          </p>
        </div>
        <Link id="create-classroom-trigger" href="/dashboard/teacher/classes?create=1" scroll={false} className={buttonVariants({ variant: "brand", size: "sm" })}>
          <Plus className="size-3.5" />
          Create classroom
        </Link>
      </section>

      {query.create === "1" && (
          <CreateClassroomForm defaultOpen />
      )}

      {data.classrooms.length === 0 && query.create !== "1" ? (
        <EmptyClassrooms role="teacher" />
      ) : data.classrooms.length > 0 ? (
        <section className="space-y-3" aria-label="Your classrooms">
          <p className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <BookOpen className="size-3.5" />
            {data.classrooms.length} classroom{data.classrooms.length === 1 ? "" : "s"}
          </p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] items-start gap-4">
            {data.classrooms.map((classroom, index) => (
              <TeacherClassCard
                key={classroom.id}
                classroom={classroom}
                index={index}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
