import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CheckCircle2,
  Download,
  Fingerprint,
  Hash,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { verifyAttendanceReport } from "@/lib/audit";
import { formatDate, formatMethod } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Verify attendance report",
  robots: { index: false, follow: false },
};

export default async function PublicReportVerifier({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  const verification = await verifyAttendanceReport(reportId);
  if (!verification) notFound();
  const { report, valid } = verification;

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-5 dark:bg-[var(--background)] sm:px-6 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center justify-between">
          <BrandLogo href="/" />
          <ThemeToggle />
        </header>

        <section className="mt-10 overflow-hidden rounded-xl border border-black/8 bg-[#151a17] p-6 text-white shadow-soft sm:p-9 dark:border-white/8 dark:bg-[var(--surface)]">
          <span
            className={
              valid
                ? "grid size-14 place-items-center rounded-2xl bg-lime-300 text-[#152006]"
                : "grid size-14 place-items-center rounded-2xl bg-red-400 text-red-950"
            }
          >
            {valid ? (
              <ShieldCheck className="size-7" />
            ) : (
              <ShieldAlert className="size-7" />
            )}
          </span>
          <p className="mt-7 text-[0.65rem] font-semibold tracking-[0.16em] text-cyan-300 uppercase">
            Independent report verifier
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] sm:text-5xl">
            {valid
              ? "This attendance report is intact."
              : "This report failed verification."}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/46">
            {report.session.classroom.name} ·{" "}
            {report.session.classroom.subjectCode} ·{" "}
            {formatDate(report.session.startedAt)}
          </p>
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <VerificationCheck
            label="Hash chain"
            valid={verification.chainValid}
            detail={`${report.eventCount} events`}
          />
          <VerificationCheck
            label="Payload"
            valid={verification.payloadValid}
            detail={`${report.recordCount} records`}
          />
          <VerificationCheck
            label="Ed25519 signature"
            valid={verification.signatureValid}
            detail={formatMethod(report.session.method)}
          />
          <VerificationCheck
            label="Signing identity"
            valid={verification.keyTrusted}
            detail="Pinned server key"
          />
        </section>

        <section className="mt-5 rounded-xl border border-black/8 bg-[var(--surface)] p-5 shadow-card dark:border-white/8 dark:bg-[var(--surface)] sm:p-7">
          <div className="grid gap-5 sm:grid-cols-2">
            <VerifierHash
              icon={Hash}
              label="Sealed chain head"
              value={report.headHash}
            />
            <VerifierHash
              icon={Fingerprint}
              label="Signing key fingerprint"
              value={verification.keyFingerprint}
            />
          </div>
          <div className="mt-6 flex flex-wrap gap-2 border-t border-black/6 pt-5 dark:border-white/7">
            <a
              href={`/api/attendance/reports/${reportId}`}
              download
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#151a17] px-4 text-xs font-semibold text-white dark:bg-[var(--accent)] dark:text-[var(--accent-ink)]"
            >
              <Download className="size-3.5" />
              Download signed artifact
            </a>
            <Link
              href="/"
              className="inline-flex h-10 items-center rounded-xl border border-black/8 px-4 text-xs font-semibold text-slate-600 dark:border-white/8 dark:text-white/50"
            >
              About ClassPulse
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function VerificationCheck({
  label,
  valid,
  detail,
}: {
  label: string;
  valid: boolean;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-black/8 bg-[var(--surface)] p-4 dark:border-white/8 dark:bg-[var(--surface)]">
      <div className="flex items-center gap-2">
        {valid ? (
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-blue-300" />
        ) : (
          <ShieldAlert className="size-4 text-red-600 dark:text-red-300" />
        )}
        <p className="text-xs font-semibold text-slate-800 dark:text-white/75">
          {label}
        </p>
      </div>
      <p className="mt-2 text-[0.65rem] font-semibold text-slate-500 dark:text-white/60">
        {valid ? "Verified" : "Invalid"} · {detail}
      </p>
    </div>
  );
}

function VerifierHash({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Hash;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-2 text-[0.62rem] font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-white/60">
        <Icon className="size-3.5" />
        {label}
      </p>
      <p className="mt-2 break-all font-mono text-[0.68rem] leading-5 text-slate-600 dark:text-white/60">
        {value}
      </p>
    </div>
  );
}
