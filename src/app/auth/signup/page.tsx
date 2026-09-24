import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create account",
};

export default function SignupPage() {
  return (
    <div className="auth-signup mx-auto max-w-xl">
      <p className="editorial-label text-[var(--accent)]">
        Begin with your role
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
        Make yourself at home.
      </h1>
      <p className="mt-5 max-w-md text-sm leading-6 text-slate-500 dark:text-white/60">
        Create a teacher or student account to get started.
      </p>
      <SignupForm />
      <p className="mt-7 text-center text-xs text-slate-500 dark:text-white/60">
        Already have an account?{" "}
        <Link
          href="/auth/login"
          className="font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
