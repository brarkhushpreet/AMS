import type { Metadata } from "next";
import { Fingerprint, ShieldCheck } from "lucide-react";
import { requireProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { PasskeyManager } from "@/components/security/passkey-manager";

export const metadata: Metadata = { title: "Device security" };

export default async function SecurityPage() {
  const profile = await requireProfile();
  const passkeys = await db.passkeyCredential.findMany({
    where: { userId: profile.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      deviceType: true,
      backedUp: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-5 rounded-xl border border-black/8 bg-[var(--surface)] p-6 shadow-card sm:flex-row sm:items-end sm:p-8 dark:border-white/8 dark:bg-[var(--surface)]">
        <div>
          <p className="editorial-label text-violet-700 dark:text-violet-300">
            Account security
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-4xl dark:text-white">
            Your device becomes part of the proof.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 dark:text-white/60">
            Passkeys add biometric or device-PIN confirmation after presence
            verification without storing biometric information in ClassPulse.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-emerald-700/10 bg-emerald-100/55 px-3 py-2 text-[0.68rem] font-semibold text-emerald-800 dark:border-blue-300/10 dark:bg-blue-300/8 dark:text-blue-300">
          <ShieldCheck className="size-4" />
          Phishing-resistant
          <Fingerprint className="size-4" />
        </div>
      </section>

      <PasskeyManager
        initialPasskeys={passkeys.map((passkey) => ({
          ...passkey,
          createdAt: passkey.createdAt.toISOString(),
          lastUsedAt: passkey.lastUsedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
