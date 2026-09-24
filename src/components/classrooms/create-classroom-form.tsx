"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, LoaderCircle, Plus, Sparkles, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form-controls";

export function CreateClassroomForm({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setPending(true);
    setError("");
    try {
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
    } catch {
      setError("Could not reach the server. Please try again.");
      toast.error("Classroom could not be created");
    } finally { setPending(false); }
  }

  if (!defaultOpen) {
    return (
      <Link href="/dashboard/teacher/classes?create=1" className={buttonVariants({ variant: "brand", size: "sm" })}>
        <Plus className="size-3.5" /> Create classroom
      </Link>
    );
  }

  return (
    <Dialog.Root open={defaultOpen} onOpenChange={(open) => { if (!open && !pending) router.replace("/dashboard/teacher/classes", { scroll: false }); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[100] bg-slate-950/35 backdrop-blur-[2px]" />
      <Dialog.Content
        className="fixed top-1/2 left-1/2 z-[101] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-xl"
        onCloseAutoFocus={(event) => { event.preventDefault(); document.getElementById("create-classroom-trigger")?.focus(); }}
        onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
        onInteractOutside={(event) => { if (pending) event.preventDefault(); }}
      >
      <Dialog.Close aria-label="Close create classroom" disabled={pending} className="absolute top-4 right-4 grid size-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-soft)] disabled:opacity-50"><X className="size-4" /></Dialog.Close>
    <form
      action={submit}
      className="p-6"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
          <BookOpen className="size-4.5" />
        </span>
        <div>
          <Dialog.Title className="text-base font-semibold text-[var(--foreground)]">New classroom</Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-[var(--muted)]">
            You&apos;ll be the owner and teacher.
          </Dialog.Description>
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
        <Button type="button" variant="ghost" disabled={pending} onClick={() => router.replace("/dashboard/teacher/classes", { scroll: false })}>
          Cancel
        </Button>
      </div>
    </form>
      </Dialog.Content>
    </Dialog.Portal>
    </Dialog.Root>
  );
}
