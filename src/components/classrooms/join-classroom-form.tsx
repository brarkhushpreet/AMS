"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, KeyRound, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form-controls";

export function JoinClassroomForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(formData: FormData) {
    setPending(true);
    setError("");
    setSuccess("");
    const joinCode = String(formData.get("joinCode") ?? "").toUpperCase();
    const response = await fetch("/api/classrooms/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ joinCode }),
    });
    const result = await response.json();
    setPending(false);
    if (!response.ok) {
      const message = result.error ?? "Could not join this classroom.";
      setError(message);
      toast.error("Could not join classroom", { description: message });
      return;
    }
    setSuccess(`You joined ${result.classroom.name}.`);
    toast.success("Classroom joined", {
      description: `${result.classroom.name} is now in your workspace.`,
    });
    setTimeout(() => {
      router.push(`/dashboard/student/classes/${result.classroom.id}`);
      router.refresh();
    }, 650);
  }

  return (
    <form action={submit} className="mt-7 space-y-5">
      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          <CheckCircle2 className="size-4" />
          {success}
        </p>
      )}
      <div>
        <Label htmlFor="joinCode">Classroom code</Label>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="joinCode"
            name="joinCode"
            placeholder="AB7K9QX"
            minLength={6}
            maxLength={10}
            className="pl-10 font-black tracking-[0.25em] uppercase"
            required
          />
        </div>
      </div>
      <Button type="submit" variant="brand" size="lg" className="w-full" disabled={pending}>
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
        {pending ? "Joining…" : "Join classroom"}
      </Button>
    </form>
  );
}
