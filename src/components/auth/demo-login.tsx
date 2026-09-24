"use client";

import { useActionState } from "react";
import { GraduationCap, Presentation } from "lucide-react";
import { demoLoginAction } from "@/lib/auth-actions";
import type { AuthActionState } from "@/lib/validation";
import { Button } from "@/components/ui/button";

export function DemoLogin() {
  const [state, action, pending] = useActionState(demoLoginAction, {} as AuthActionState);
  return (
    <form action={action} className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3" aria-label="Explore demo accounts" aria-busy={pending}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--foreground)]">Just exploring?</p>
        <span className="text-[10px] text-[var(--muted)]">No signup needed · Read-only</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="submit" name="role" value="TEACHER" variant="secondary" size="sm" disabled={pending}>
          <Presentation aria-hidden="true" className="size-4 text-[var(--accent)]" />
          Try as teacher
        </Button>
        <Button type="submit" name="role" value="STUDENT" variant="secondary" size="sm" disabled={pending}>
          <GraduationCap aria-hidden="true" className="size-4 text-[var(--accent)]" />
          Try as student
        </Button>
      </div>
      {pending && <p role="status" className="mt-2 text-xs text-[var(--muted)]">Opening your demo workspace…</p>}
      {state.error && <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-300">{state.error}</p>}
    </form>
  );
}
