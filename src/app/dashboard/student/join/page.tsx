import type { Metadata } from "next";
import { KeyRound, Link2, MailCheck } from "lucide-react";
import { requireRole } from "@/lib/current-profile";
import { JoinClassroomForm } from "@/components/classrooms/join-classroom-form";

export const metadata: Metadata = { title: "Join a classroom" };

export default async function JoinClassroomPage() {
  await requireRole("STUDENT");
  return (
    <div className="mx-auto max-w-2xl py-4 sm:py-10">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft sm:p-10">
        <span className="grid size-13 place-items-center rounded-2xl bg-blue-50 text-blue-600">
          <KeyRound className="size-5" />
        </span>
        <h2 className="mt-6 text-3xl font-semibold tracking-[-0.04em] text-slate-950">
          Join a classroom
        </h2>
        <p className="mt-3 leading-7 text-slate-500">
          Enter the private code shared by your teacher. Codes are not case-sensitive.
        </p>
        <JoinClassroomForm />
        <div className="mt-8 grid gap-3 border-t border-slate-100 pt-6 sm:grid-cols-2">
          <div className="flex gap-3 rounded-xl bg-slate-50 p-3">
            <Link2 className="mt-0.5 size-4 shrink-0 text-blue-500" />
            <p className="text-xs leading-5 text-slate-500">
              Your teacher can copy the code from the classroom page.
            </p>
          </div>
          <div className="flex gap-3 rounded-xl bg-slate-50 p-3">
            <MailCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" />
            <p className="text-xs leading-5 text-slate-500">
              CSV invitations attach automatically when your email matches.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
