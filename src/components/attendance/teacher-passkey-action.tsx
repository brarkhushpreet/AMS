"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Fingerprint, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form-controls";
import { SelectField } from "@/components/ui/select-field";
import { readApiJson } from "@/lib/read-api-json";

type TeacherAction =
  | { action: "CORRECT_ATTENDANCE"; sessionId: string; studentId: string; present: boolean; reason: string }
  | { action: "SIGN_REPORT"; reportId: string };

async function confirmAction(action: TeacherAction) {
  const optionsResponse = await fetch("/api/teacher/passkey-actions", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(action),
  });
  const options = await readApiJson<{ error?: string; ceremonyId?: string; authenticationOptions?: Parameters<typeof startAuthentication>[0] }>(optionsResponse);
  if (!optionsResponse.ok || !options.ceremonyId || !options.authenticationOptions) {
    throw new Error(options.error ?? "Could not start passkey confirmation.");
  }
  const response = await startAuthentication(options.authenticationOptions);
  const verifyResponse = await fetch("/api/teacher/passkey-actions/verify", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ceremonyId: options.ceremonyId, response }),
  });
  const result = await readApiJson<{ error?: string }>(verifyResponse);
  if (!verifyResponse.ok) throw new Error(result.error ?? "Passkey confirmation failed.");
}

export function AttendanceCorrection({
  sessionId, students, hasPasskey,
}: {
  sessionId: string;
  students: { id: string; name: string; present: boolean }[];
  hasPasskey: boolean;
}) {
  const router = useRouter();
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [present, setPresent] = useState(students[0]?.present ? "absent" : "present");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const selected = students.find((student) => student.id === studentId);

  async function submit() {
    setPending(true);
    try {
      await confirmAction({ action: "CORRECT_ATTENDANCE", sessionId, studentId, present: present === "present", reason: reason.trim() });
      toast.success("Attendance corrected", { description: "The change was recorded with the session." });
      setReason("");
      router.refresh();
    } catch (error) {
      toast.error("Correction not saved", { description: error instanceof Error ? error.message : "Try again." });
    } finally { setPending(false); }
  }

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-card sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><Fingerprint className="size-5" /></span>
        <div><h3 className="font-semibold">Correct a live check-in</h3><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Requires your passkey and a reason. Corrections must be made before the session closes and its report is sealed.</p></div>
      </div>
      {!hasPasskey ? <p className="mt-4 text-sm text-[var(--muted)]">Register a passkey in <Link href="/dashboard/security" className="font-semibold text-[var(--accent)] underline">Device security</Link> to authorize corrections.</p> : students.length === 0 ? <p className="mt-4 text-sm text-[var(--muted)]">Enroll a student before making a correction.</p> : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor="correctionStudent">Student</Label><SelectField id="correctionStudent" value={studentId} onValueChange={(value) => { setStudentId(value); setPresent(students.find((student) => student.id === value)?.present ? "absent" : "present"); }} options={students.map((student) => ({ value: student.id, label: student.name, description: student.present ? "Currently present" : "No check-in" }))} /></div>
          <div><Label htmlFor="correctionStatus">Change to</Label><SelectField id="correctionStatus" value={present} onValueChange={setPresent} options={[{ value: "present", label: "Present", description: "Add a manual check-in" }, { value: "absent", label: "Not checked in", description: "Remove a mistaken check-in" }]} /></div>
          <div className="sm:col-span-2"><Label htmlFor="correctionReason">Reason for correction</Label><Input id="correctionReason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Why is this change necessary?" /></div>
          <div className="flex items-center justify-between gap-3 sm:col-span-2"><p className="text-xs text-[var(--muted)]">{selected ? `Current: ${selected.present ? "present" : "not checked in"}` : ""}</p><Button type="button" variant="brand" disabled={pending || reason.trim().length < 8 || !studentId || selected?.present === (present === "present")} onClick={submit}>{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Fingerprint className="size-4" />}{pending ? "Confirming…" : "Confirm correction"}</Button></div>
        </div>
      )}
    </section>
  );
}

export function ReportPasskeySign({ reportId, hasPasskey }: { reportId: string; hasPasskey: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function sign() {
    setPending(true);
    try {
      await confirmAction({ action: "SIGN_REPORT", reportId });
      toast.success("Report countersigned", { description: "Your passkey confirmation is attached to this sealed report." });
      router.refresh();
    } catch (error) {
      toast.error("Report not signed", { description: error instanceof Error ? error.message : "Try again." });
    } finally { setPending(false); }
  }
  return <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-card sm:p-6"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><Fingerprint className="size-5" /></span><div><h3 className="font-semibold">Teacher approval</h3><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Confirm the final report with a passkey. The approval is attached to this report and can be verified later.</p></div></div>{hasPasskey ? <Button type="button" variant="brand" className="mt-4" disabled={pending} onClick={sign}>{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Fingerprint className="size-4" />}{pending ? "Confirming…" : "Sign report with passkey"}</Button> : <p className="mt-4 text-sm text-[var(--muted)]">First <Link href="/dashboard/security" className="font-semibold text-[var(--accent)] underline">register a teacher passkey</Link>.</p>}</section>;
}
