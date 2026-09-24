"use client";

import { useEffect, useState } from "react";
import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { toast } from "sonner";
import {
  Fingerprint,
  KeyRound,
  Laptop2,
  LifeBuoy,
  LoaderCircle,
  Copy,
  Download,
  ShieldCheck,
  Smartphone,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form-controls";

type PasskeyItem = {
  id: string;
  name: string;
  deviceType: string;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

export function PasskeyManager({
  initialPasskeys,
}: {
  initialPasskeys: PasskeyItem[];
}) {
  const [passkeys, setPasskeys] = useState(initialPasskeys);
  const [supported, setSupported] = useState(true);
  const [name, setName] = useState("My device");
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryToken, setRecoveryToken] = useState<string | null>(
    null,
  );
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setSupported(browserSupportsWebAuthn());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  async function authorizeManagement() {
    const optionsResponse = await fetch(
      "/api/passkeys/management/options",
      { method: "POST" },
    );
    const options = await optionsResponse.json();
    if (!optionsResponse.ok) {
      throw new Error(
        options.error ?? "Could not authorize this security change.",
      );
    }
    const assertion = await startAuthentication(
      options.authenticationOptions,
    );
    const verificationResponse = await fetch(
      "/api/passkeys/management/verify",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ceremonyId: options.ceremonyId,
          response: assertion,
        }),
      },
    );
    const verification = await verificationResponse.json();
    if (!verificationResponse.ok) {
      throw new Error(
        verification.error ?? "Passkey authorization failed.",
      );
    }
    return verification.managementToken as string;
  }

  async function register() {
    setPending(true);
    try {
      const managementToken =
        passkeys.length > 0
          ? recoveryToken ?? (await authorizeManagement())
          : undefined;
      const optionsResponse = await fetch(
        "/api/passkeys/registration/options",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ managementToken }),
        },
      );
      const options = await optionsResponse.json();
      if (!optionsResponse.ok) {
        throw new Error(options.error ?? "Could not start passkey registration.");
      }
      setRecoveryToken(null);
      const response = await startRegistration(options);
      const verifyResponse = await fetch(
        "/api/passkeys/registration/verify",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: name.trim() || "My device", response }),
        },
      );
      const result = await verifyResponse.json();
      if (!verifyResponse.ok) {
        throw new Error(result.error ?? "Passkey verification failed.");
      }
      setPasskeys((current) => [
        {
          id: result.credentialId,
          name: name.trim() || "My device",
          deviceType: "registered",
          backedUp: false,
          createdAt: new Date().toISOString(),
          lastUsedAt: null,
        },
        ...current.filter((item) => item.id !== result.credentialId),
      ]);
      if (Array.isArray(result.recoveryCodes)) {
        setRecoveryCodes(result.recoveryCodes);
      }
      toast.success("Passkey registered", {
        description:
          "Future attendance proofs can now be bound to this device.",
      });
    } catch (error) {
      toast.error("Passkey was not registered", {
        description:
          error instanceof Error ? error.message : "Registration was cancelled.",
      });
    } finally {
      setPending(false);
    }
  }

  async function remove(credentialId: string) {
    if (confirming !== credentialId) {
      setConfirming(credentialId);
      window.setTimeout(
        () =>
          setConfirming((current) =>
            current === credentialId ? null : current,
          ),
        4_000,
      );
      return;
    }
    try {
      const managementToken =
        recoveryToken ?? (await authorizeManagement());
      const response = await fetch(`/api/passkeys/${credentialId}`, {
        method: "DELETE",
        headers: {
          "x-passkey-management-token": managementToken,
        },
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "Passkey could not be removed.");
      }
      setRecoveryToken(null);
      setPasskeys((current) =>
        current.filter((item) => item.id !== credentialId),
      );
      setConfirming(null);
      toast.success("Passkey removed");
    } catch (error) {
      toast.error("Passkey could not be removed", {
        description:
          error instanceof Error
            ? error.message
            : "Security authorization failed.",
      });
    }
  }

  async function authorizeWithRecoveryCode() {
    setRecovering(true);
    try {
      const response = await fetch(
        "/api/passkeys/management/recover",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ recoveryCode }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "Recovery failed.");
      }
      setRecoveryToken(result.managementToken);
      setRecoveryCode("");
      toast.success("Recovery authorization ready", {
        description:
          "Register a replacement passkey within the next two minutes.",
      });
    } catch (error) {
      toast.error("Recovery code was not accepted", {
        description:
          error instanceof Error ? error.message : "Recovery failed.",
      });
    } finally {
      setRecovering(false);
    }
  }

  async function copyRecoveryCodes() {
    await navigator.clipboard.writeText(recoveryCodes.join("\n"));
    toast.success("Recovery codes copied");
  }

  function downloadRecoveryCodes() {
    const blob = new Blob(
      [
        `ClassPulse passkey recovery codes\n\n${recoveryCodes.join("\n")}\n\nEach code can be used once.`,
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "classpulse-recovery-codes.txt";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Recovery codes downloaded");
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
      <section className="rounded-xl border border-black/8 bg-[#151a17] p-6 text-white shadow-soft dark:border-white/8 dark:bg-[var(--surface)]">
        <span className="grid size-12 place-items-center rounded-2xl bg-lime-300 text-[#152006]">
          <Fingerprint className="size-6" />
        </span>
        <p className="mt-6 text-[0.62rem] font-semibold tracking-[0.16em] text-lime-300 uppercase">
          Passkey-confirmed verification
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
          Bind attendance to a passkey.
        </h2>
        <p className="mt-3 text-sm leading-6 text-white/48">
          After presence is detected, your device signs a fresh server
          challenge. Password sharing alone can no longer complete check-in.
        </p>

        <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.055] p-4">
          {!supported ? (
            <p className="text-xs font-bold text-amber-200">
              This browser does not expose WebAuthn. Use a current browser on a
              device with a screen lock or security key.
            </p>
          ) : (
            <>
              <Label htmlFor="passkeyName">
                Device label
              </Label>
              <Input
                id="passkeyName"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={60}
                placeholder="Personal laptop"
                className="border-white/10 bg-white/8 text-white"
              />
              <Button
                type="button"
                variant="brand"
                className="mt-3 w-full"
                onClick={register}
                disabled={pending}
              >
                {pending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <KeyRound className="size-4" />
                )}
                {pending ? "Opening device security…" : "Register passkey"}
              </Button>
            </>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-black/8 bg-[var(--surface)] p-5 shadow-card dark:border-white/8 dark:bg-[var(--surface)] sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-slate-950 dark:text-white">
              Trusted authenticators
            </h3>
            <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-white/60">
              {passkeys.length} registered{" "}
              {passkeys.length === 1 ? "passkey" : "passkeys"}
            </p>
          </div>
          <span className="grid size-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-blue-300/10 dark:text-blue-300">
            <ShieldCheck className="size-5" />
          </span>
        </div>

        {passkeys.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-black/10 p-8 text-center dark:border-white/10">
            <Laptop2 className="mx-auto size-7 text-slate-300 dark:text-white/20" />
            <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-white/70">
              No passkey registered
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-white/60">
              Attendance still works, but records will show standard rather
              than passkey-confirmed assurance.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-2">
            {passkeys.map((passkey) => (
              <div
                key={passkey.id}
                className="flex items-center gap-3 rounded-2xl border border-black/7 bg-white/55 p-3 dark:border-white/7 dark:bg-white/[0.035]"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-300/10 dark:text-violet-300">
                  {passkey.backedUp ? (
                    <Smartphone className="size-4.5" />
                  ) : (
                    <Laptop2 className="size-4.5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-800 dark:text-white/80">
                    {passkey.name}
                  </p>
                  <p className="mt-0.5 text-[0.62rem] font-semibold text-slate-500 dark:text-white/60">
                    Added{" "}
                    {new Date(passkey.createdAt).toLocaleDateString("en", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {passkey.lastUsedAt
                      ? ` · used ${new Date(passkey.lastUsedAt).toLocaleDateString("en", { month: "short", day: "numeric" })}`
                      : " · not used yet"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(passkey.id)}
                  className={
                    confirming === passkey.id
                      ? "rounded-xl bg-red-600 px-3 py-2 text-[0.65rem] font-semibold text-white"
                      : "grid size-9 place-items-center rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-white/60 dark:hover:bg-red-300/8 dark:hover:text-red-300"
                  }
                  aria-label={`Remove ${passkey.name}`}
                >
                  {confirming === passkey.id ? (
                    "Confirm"
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {recoveryCodes.length > 0 ? (
          <div className="mt-5 rounded-2xl border border-amber-700/15 bg-amber-50 p-4 dark:border-amber-300/12 dark:bg-amber-300/7">
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
              Save these one-time recovery codes now
            </p>
            <p className="mt-1 text-[0.68rem] leading-5 font-semibold text-amber-800/65 dark:text-amber-200/55">
              They will not be displayed again. A code can authorize a
              replacement device if your passkey is unavailable.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-xl bg-white/65 p-3 font-mono text-[0.68rem] font-bold text-amber-950 dark:bg-black/15 dark:text-amber-100">
              {recoveryCodes.map((code) => (
                <span key={code}>{code}</span>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={copyRecoveryCodes}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-amber-900 px-3 text-[0.65rem] font-semibold text-white dark:bg-amber-200 dark:text-amber-950"
              >
                <Copy className="size-3.5" />
                Copy
              </button>
              <button
                type="button"
                onClick={downloadRecoveryCodes}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-amber-800/15 px-3 text-[0.65rem] font-semibold text-amber-900 dark:border-amber-200/15 dark:text-amber-200"
              >
                <Download className="size-3.5" />
                Download
              </button>
            </div>
          </div>
        ) : null}

        {passkeys.length > 0 ? (
          <div className="mt-5 border-t border-black/6 pt-5 dark:border-white/7">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/6 dark:text-white/60">
                <LifeBuoy className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800 dark:text-white/75">
                  Lost access to your passkey?
                </p>
                <p className="mt-1 text-[0.65rem] leading-5 text-slate-500 dark:text-white/60">
                  Use one saved code, then register a replacement within two
                  minutes.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={recoveryCode}
                    onChange={(event) =>
                      setRecoveryCode(event.target.value)
                    }
                    placeholder="CP-XXXX-XXXXXX"
                    className="font-mono uppercase"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={authorizeWithRecoveryCode}
                    disabled={recovering || recoveryCode.length < 8}
                    className="shrink-0"
                  >
                    {recovering ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <LifeBuoy className="size-4" />
                    )}
                    Authorize recovery
                  </Button>
                </div>
                {recoveryToken ? (
                  <p className="mt-2 text-[0.65rem] font-semibold text-emerald-700 dark:text-blue-300">
                    Recovery authorized. Register the replacement device now.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
