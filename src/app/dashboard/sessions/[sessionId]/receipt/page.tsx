import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Fingerprint,
  Hash,
  KeyRound,
  Link2,
  ShieldCheck,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireProfile } from "@/lib/current-profile";
import {
  ensureAttendanceReport,
  verifyAttendanceReport,
} from "@/lib/audit";
import { ReportActions } from "@/components/attendance/report-actions";
import { StatusPill } from "@/components/ui/status-pill";
import { formatDate, formatMethod } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Verified attendance receipt",
};

export default async function AttendanceReceiptPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const [profile, { sessionId }] = await Promise.all([
    requireProfile(),
    params,
  ]);
  const session = await db.attendanceSession.findUnique({
    where: { id: sessionId },
    include: {
      classroom: {
        include: {
          enrollments: {
            where: { studentId: profile.student?.id },
            select: { id: true },
          },
        },
      },
      attendanceRecords: {
        select: { deviceVerified: true },
      },
    },
  });
  const allowed =
    session &&
    ((profile.role === "TEACHER" &&
      session.classroom.teacherId === profile.teacher?.id) ||
      (profile.role === "STUDENT" &&
        session.classroom.enrollments.length > 0));
  if (!session || !allowed) notFound();

  let report;
  try {
    report = await ensureAttendanceReport(session.id);
  } catch {
    report = null;
  }
  const verification = report
    ? await verifyAttendanceReport(report.id)
    : null;
  const backHref =
    profile.role === "TEACHER"
      ? "/dashboard/teacher/attendance"
      : "/dashboard/student/attendance";
  const deviceBound = session.attendanceRecords.filter(
    (record) => record.deviceVerified,
  ).length;

  return (
    <div className="space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-950 dark:text-white/60 dark:hover:text-white"
      >
        <ArrowLeft className="size-3.5" />
        Attendance archive
      </Link>

      <section className="overflow-hidden rounded-xl border border-black/8 bg-[#151a17] text-white shadow-soft dark:border-white/8 dark:bg-[var(--surface)]">
        <div className="grid gap-7 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="flex items-center gap-2">
              <StatusPill tone={verification?.valid ? "green" : "amber"}>
                {verification?.valid
                  ? "Cryptographically valid"
                  : session.status === "ACTIVE"
                    ? "Waiting for session close"
                    : "Report unavailable"}
              </StatusPill>
            </div>
            <p className="mt-5 text-[0.62rem] font-semibold tracking-[0.16em] text-cyan-300 uppercase">
              {session.classroom.subjectCode} ·{" "}
              {formatMethod(session.method)}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
              Verifiable attendance receipt
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/45">
              {session.classroom.name} · {formatDate(session.startedAt)}
            </p>
          </div>
          {report ? <ReportActions reportId={report.id} /> : null}
        </div>
      </section>

      {verification ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ProofStat
              icon={Link2}
              label="Audit chain"
              value={verification.chainValid ? "Intact" : "Broken"}
              detail={`${verification.report.eventCount} sealed events`}
            />
            <ProofStat
              icon={KeyRound}
              label="Ed25519 signature"
              value={
                verification.signatureValid ? "Verified" : "Invalid"
              }
              detail="Server signing identity"
            />
            <ProofStat
              icon={ShieldCheck}
              label="Attendance"
              value={String(verification.report.recordCount)}
              detail="Records sealed in report"
            />
            <ProofStat
              icon={Fingerprint}
              label="Passkey-confirmed"
              value={String(deviceBound)}
              detail="Passkey-confirmed records"
            />
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <HashPanel
              title="Sealed chain head"
              value={verification.report.headHash}
              icon={Hash}
            />
            <HashPanel
              title="Signing key fingerprint"
              value={verification.keyFingerprint}
              icon={KeyRound}
            />
          </section>
        </>
      ) : (
        <section className="rounded-2xl border border-amber-700/12 bg-amber-50 p-6 text-amber-900 dark:border-amber-300/10 dark:bg-amber-300/7 dark:text-amber-200">
          <h3 className="font-semibold">
            The receipt will be sealed when attendance closes.
          </h3>
          <p className="mt-2 text-sm opacity-70">
            Active sessions cannot be signed because their audit chain is
            still changing.
          </p>
        </section>
      )}
    </div>
  );
}

function ProofStat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-black/8 bg-[var(--surface)] p-5 shadow-card dark:border-white/8 dark:bg-[var(--surface)]">
      <Icon className="size-5 text-emerald-700 dark:text-blue-300" />
      <p className="mt-5 text-[0.62rem] font-semibold tracking-[0.13em] text-slate-500 uppercase dark:text-white/60">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
        {value}
      </p>
      <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-white/60">
        {detail}
      </p>
    </div>
  );
}

function HashPanel({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: typeof Hash;
}) {
  return (
    <div className="rounded-2xl border border-black/8 bg-[var(--surface)] p-5 dark:border-white/8 dark:bg-[var(--surface)]">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-violet-600 dark:text-violet-300" />
        <h3 className="text-xs font-semibold text-slate-800 dark:text-white/75">
          {title}
        </h3>
      </div>
      <p className="mt-4 break-all rounded-xl bg-black/[0.035] p-3 font-mono text-[0.68rem] leading-5 text-slate-500 dark:bg-white/[0.045] dark:text-white/60">
        {value}
      </p>
    </div>
  );
}
