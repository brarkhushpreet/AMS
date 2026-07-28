"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { toast } from "sonner";
import { loginAction } from "@/lib/auth-actions";
import type { AuthActionState } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form-controls";
import { notifyAuthCompanion } from "@/components/auth/auth-companion";

const initialState: AuthActionState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordTyping, setPasswordTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (passwordVisible || passwordTyping) {
      notifyAuthCompanion("shy");
    } else if (state.error) {
      notifyAuthCompanion("error");
    } else {
      notifyAuthCompanion("curious");
    }
  }, [passwordTyping, passwordVisible, state.error]);

  useEffect(() => {
    if (state.error) {
      toast.error("Could not sign in", { description: state.error });
    }
  }, [state.error]);

  useEffect(
    () => () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    },
    [],
  );

  function togglePasswordVisibility() {
    setPasswordVisible((visible) => !visible);
  }

  function handlePasswordTyping() {
    setPasswordTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      setPasswordTyping(false);
    }, 700);
  }

  return (
    <form action={action} className="mt-8 space-y-5">
      {state.error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-300/15 dark:bg-red-300/8 dark:text-red-300"
        >
          {state.error}
        </div>
      )}
      <div>
        <Label htmlFor="email">Email address</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@college.edu"
            className="pl-10"
            required
          />
        </div>
        {state.fieldErrors?.email?.[0] && (
          <p className="mt-1.5 text-xs font-semibold text-red-600">
            {state.fieldErrors.email[0]}
          </p>
        )}
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <span className="mb-2 text-xs font-semibold text-slate-400">
            8+ characters
          </span>
        </div>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="password"
            name="password"
            type={passwordVisible ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Your password"
            className="pl-10 pr-11"
            onChange={handlePasswordTyping}
            required
          />
          <button
            type="button"
            onClick={togglePasswordVisibility}
            className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-black/5 hover:text-slate-700 dark:text-white/35 dark:hover:bg-white/8 dark:hover:text-white"
            aria-label={passwordVisible ? "Hide password" : "Show password"}
            aria-pressed={passwordVisible}
          >
            {passwordVisible ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
        {state.fieldErrors?.password?.[0] && (
          <p className="mt-1.5 text-xs font-semibold text-red-600">
            {state.fieldErrors.password[0]}
          </p>
        )}
      </div>
      <Button type="submit" variant="brand" size="lg" className="w-full" disabled={pending}>
        {pending ? "Logging in…" : "Log in"}
        {!pending && <ArrowRight className="size-4" />}
      </Button>
    </form>
  );
}
