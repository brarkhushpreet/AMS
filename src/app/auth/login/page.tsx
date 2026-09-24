import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { DemoLogin } from "@/components/auth/demo-login";
import { demoEnabled } from "@/lib/demo-policy";

export const metadata: Metadata = {
  title: "Log in",
};

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md">
      <p className="editorial-label text-[var(--accent)]">
        Your workspace
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
        Welcome back.
      </h1>
      <p className="mt-5 max-w-sm text-sm leading-6 text-slate-500 dark:text-white/60">
        Sign in to your classrooms and attendance records.
      </p>
      <LoginForm />
      {demoEnabled() && <DemoLogin />}
      <p className="mt-4 text-center text-xs text-slate-500 dark:text-white/60">
        New to ClassPulse?{" "}
        <Link
          href="/auth/signup"
          className="font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
