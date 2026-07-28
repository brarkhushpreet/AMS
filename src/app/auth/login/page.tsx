import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Log in",
};

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md">
      <p className="editorial-label text-emerald-700 dark:text-lime-300">
        Returning to the room
      </p>
      <h1 className="mt-4 text-5xl leading-[0.95] font-black tracking-[-0.06em] text-slate-950 dark:text-white">
        Pick up where
        <span className="block font-serif font-normal italic text-slate-400 dark:text-white/38">
          class left off.
        </span>
      </h1>
      <p className="mt-5 max-w-sm text-sm leading-6 text-slate-500 dark:text-white/45">
        Sign in to open your classrooms, live sessions, and attendance story.
      </p>
      <LoginForm />
      <p className="mt-7 text-center text-xs text-slate-500 dark:text-white/42">
        New to ClassPulse?{" "}
        <Link
          href="/auth/signup"
          className="font-extrabold text-emerald-700 hover:text-emerald-800 dark:text-lime-300"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
