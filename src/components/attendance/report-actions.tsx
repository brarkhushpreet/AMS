"use client";

import { useState } from "react";
import { Check, Copy, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export function ReportActions({ reportId }: { reportId: string }) {
  const [copied, setCopied] = useState(false);
  const verificationPath = `/verify/attendance/${reportId}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${verificationPath}`,
      );
      setCopied(true);
      toast.success("Verification link copied");
      window.setTimeout(() => setCopied(false), 1_600);
    } catch {
      toast.error("Could not copy verification link");
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={verificationPath}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#151a17] px-4 text-xs font-semibold text-white  dark:bg-[var(--accent)] dark:text-[var(--accent-ink)]"
      >
        <ExternalLink className="size-3.5" />
        Public verifier
      </a>
      <button
        type="button"
        onClick={copyLink}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/8 bg-white/60 px-4 text-xs font-semibold text-slate-600 hover:border-black/15 dark:border-white/8 dark:bg-white/5 dark:text-white/55"
      >
        {copied ? (
          <Check className="size-3.5 text-emerald-600" />
        ) : (
          <Copy className="size-3.5" />
        )}
        Copy link
      </button>
      <a
        href={`/api/attendance/reports/${reportId}`}
        download
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/8 bg-white/60 px-4 text-xs font-semibold text-slate-600 hover:border-black/15 dark:border-white/8 dark:bg-white/5 dark:text-white/55"
      >
        <Download className="size-3.5" />
        Signed JSON
      </a>
    </div>
  );
}
