"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  School,
} from "lucide-react";
import { toast } from "sonner";
import { signupAction } from "@/lib/auth-actions";
import type { AuthActionState } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form-controls";
import { cn } from "@/lib/utils";
import { notifyAuthCompanion } from "@/components/auth/auth-companion";

const initialState: AuthActionState = {};

export function SignupForm() {
  const [role, setRole] = useState<"STUDENT" | "TEACHER">("STUDENT");
  const [state, action, pending] = useActionState(signupAction, initialState);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [passwordTyping, setPasswordTyping] = useState(false);
  const [confirmationTyping, setConfirmationTyping] = useState(false);
  const passwordTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const confirmationTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    if (
      passwordVisible ||
      confirmationVisible ||
      passwordTyping ||
      confirmationTyping
    ) {
      notifyAuthCompanion("shy");
    } else if (state.error) {
      notifyAuthCompanion("error");
    } else if (state.success) {
      notifyAuthCompanion("happy");
    }
  }, [
    confirmationVisible,
    confirmationTyping,
    passwordTyping,
    passwordVisible,
    state.error,
    state.success,
  ]);

  useEffect(() => {
    if (state.error) {
      toast.error("Could not create account", { description: state.error });
    }
    if (state.success) {
      toast.success("Account created", { description: state.success });
    }
  }, [state.error, state.success]);

  useEffect(
    () => () => {
      if (passwordTypingTimer.current) {
        clearTimeout(passwordTypingTimer.current);
      }
      if (confirmationTypingTimer.current) {
        clearTimeout(confirmationTypingTimer.current);
      }
    },
    [],
  );

  const errorFor = (field: string) => state.fieldErrors?.[field]?.[0];

  function togglePassword(field: "password" | "confirmation") {
    if (field === "password") {
      setPasswordVisible((visible) => !visible);
      return;
    }

    setConfirmationVisible((visible) => !visible);
  }

  function handlePasswordTyping(field: "password" | "confirmation") {
    if (field === "password") {
      setPasswordTyping(true);
      if (passwordTypingTimer.current) {
        clearTimeout(passwordTypingTimer.current);
      }
      passwordTypingTimer.current = setTimeout(() => {
        setPasswordTyping(false);
      }, 700);
      return;
    }

    setConfirmationTyping(true);
    if (confirmationTypingTimer.current) {
      clearTimeout(confirmationTypingTimer.current);
    }
    confirmationTypingTimer.current = setTimeout(() => {
      setConfirmationTyping(false);
    }, 700);
  }

  return (
    <form action={action} className="mt-5 space-y-3">
      {state.error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
        >
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {state.success}
        </div>
      )}

      <fieldset>
        <legend className="mb-1.5 text-xs font-bold text-slate-700 dark:text-white/65">
          I&apos;m joining as
        </legend>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { value: "STUDENT" as const, label: "Student", icon: GraduationCap },
            { value: "TEACHER" as const, label: "Teacher", icon: School },
          ].map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-xl border p-2.5 text-sm font-extrabold",
                role === option.value
                  ? "border-brand-500 bg-blue-50 text-brand-700 shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              )}
            >
              <input
                type="radio"
                name="role"
                value={option.value}
                checked={role === option.value}
                onChange={() => setRole(option.value)}
                className="sr-only"
              />
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-lg",
                  role === option.value ? "bg-white" : "bg-slate-100",
                )}
              >
                <option.icon className="size-4.5" />
              </span>
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name" name="name" error={errorFor("name")}>
          <Input className="h-10" name="name" id="name" autoComplete="name" placeholder="Aarav Sharma" required />
        </Field>
        <Field label="Email address" name="email" error={errorFor("email")}>
          <Input className="h-10" name="email" id="email" type="email" autoComplete="email" placeholder="you@college.edu" required />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Department" name="department" error={errorFor("department")} hint="Optional">
          <Input className="h-10" name="department" id="department" placeholder="Computer Science" />
        </Field>
        {role === "STUDENT" ? (
          <Field
            label="Registration no."
            name="registrationNumber"
            error={errorFor("registrationNumber")}
          >
            <Input className="h-10" name="registrationNumber" id="registrationNumber" placeholder="2026-CS-014" required />
          </Field>
        ) : (
          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs leading-5 text-blue-700">
            Teachers can create classrooms and invite a roster immediately after
            signing in.
          </div>
        )}
      </div>

      {role === "STUDENT" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Class" name="className" error={errorFor("className")} hint="Optional">
            <Input className="h-10" name="className" id="className" placeholder="B.Tech CSE" />
          </Field>
          <Field label="Batch" name="batch" error={errorFor("batch")} hint="Optional">
            <Input className="h-10" name="batch" id="batch" placeholder="2026–2030" />
          </Field>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Password" name="password" error={errorFor("password")}>
          <div className="relative">
            <Input
              name="password"
              id="password"
              type={passwordVisible ? "text" : "password"}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="h-10 pr-11"
              onChange={() => handlePasswordTyping("password")}
              required
            />
            <PasswordVisibilityButton
              visible={passwordVisible}
              onClick={() => togglePassword("password")}
              label="password"
            />
          </div>
        </Field>
        <Field
          label="Confirm password"
          name="confirmPassword"
          error={errorFor("confirmPassword")}
        >
          <div className="relative">
            <Input
              name="confirmPassword"
              id="confirmPassword"
              type={confirmationVisible ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Repeat your password"
              className="h-10 pr-11"
              onChange={() => handlePasswordTyping("confirmation")}
              required
            />
            <PasswordVisibilityButton
              visible={confirmationVisible}
              onClick={() => togglePassword("confirmation")}
              label="password confirmation"
            />
          </div>
        </Field>
      </div>

      <Button type="submit" variant="brand" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : `Create ${role.toLowerCase()} account`}
        {!pending && <ArrowRight className="size-4" />}
      </Button>
      <p className="text-center text-[0.65rem] leading-4 text-slate-400">
        By continuing, you agree to use classroom and location data responsibly.
      </p>
    </form>
  );
}

function PasswordVisibilityButton({
  visible,
  onClick,
  label,
}: {
  visible: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-black/5 hover:text-slate-700 dark:text-white/35 dark:hover:bg-white/8 dark:hover:text-white"
      aria-label={visible ? `Hide ${label}` : `Show ${label}`}
      aria-pressed={visible}
    >
      {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  );
}

function Field({
  label,
  name,
  error,
  hint,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={name} hint={hint}>
        {label}
      </Label>
      {children}
      {error && <p className="mt-1.5 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
