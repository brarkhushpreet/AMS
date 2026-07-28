"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, LoaderCircle, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form-controls";

export function CreateClassroomForm({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setPending(true);
    setError("");
    const response = await fetch("/api/classrooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });
    const result = await response.json();
    setPending(false);
    if (!response.ok) {
      const message = result.error ?? "Could not create the classroom.";
      setError(message);
      toast.error("Classroom could not be created", { description: message });
      return;
    }
    toast.success("Classroom created", {
      description: `${result.classroom.name} is ready for students.`,
    });
    router.push(`/dashboard/teacher/classes/${result.classroom.id}`);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-blue-300 bg-blue-50/40 p-7 text-center hover:-translate-y-1 hover:bg-blue-50 hover:shadow-soft"
      >
        <span className="grid size-12 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20 group-hover:rotate-3 group-hover:scale-105">
          <Plus className="size-5" />
        </span>
        <span className="mt-5 text-lg font-black text-slate-950">Create a classroom</span>
        <span className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
          Add your subject and get a join code instantly.
        </span>
      </button>
    );
  }

  return (
    <form
      action={submit}
      className="rounded-2xl border border-blue-200 bg-white p-5 shadow-soft sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
          <BookOpen className="size-4.5" />
        </span>
        <div>
          <h3 className="font-black text-slate-950">New classroom</h3>
          <p className="mt-1 text-xs font-semibold text-slate-400">
            You&apos;ll be the owner and teacher.
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-bold text-red-700">
          {error}
        </p>
      )}
      <div className="mt-5 space-y-4">
        <div>
          <Label htmlFor="name">Classroom name</Label>
          <Input id="name" name="name" placeholder="Data Structures" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="subjectCode">Subject code</Label>
            <Input id="subjectCode" name="subjectCode" placeholder="CS-204" required />
          </div>
          <div>
            <Label htmlFor="section" hint="Optional">Section</Label>
            <Input id="section" name="section" placeholder="A" />
          </div>
        </div>
        <div>
          <Label htmlFor="academicTerm">Academic term</Label>
          <Input id="academicTerm" name="academicTerm" placeholder="Autumn 2026" required />
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <Button type="submit" variant="brand" className="flex-1" disabled={pending}>
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {pending ? "Creating…" : "Create classroom"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
