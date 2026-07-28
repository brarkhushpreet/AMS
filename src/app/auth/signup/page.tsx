import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create account",
};

export default function SignupPage() {
  return (
    <div className="auth-signup mx-auto max-w-xl">
      <p className="editorial-label text-emerald-700 dark:text-lime-300">
        Begin with your role
      </p>
      <h1 className="mt-4 text-5xl leading-[0.95] font-black tracking-[-0.06em] text-slate-950 dark:text-white">
        A calmer way
        <span className="block font-serif font-normal italic text-slate-400 dark:text-white/38">
          to keep the room.
        </span>
      </h1>
      <p className="mt-5 max-w-md text-sm leading-6 text-slate-500 dark:text-white/45">
        Choose teacher or student. There is no administrator queue between you
        and the classroom.
      </p>
      <SignupForm />
      <p className="mt-7 text-center text-xs text-slate-500 dark:text-white/42">
        Already have an account?{" "}
        <Link
          href="/auth/login"
          className="font-extrabold text-emerald-700 hover:text-emerald-800 dark:text-lime-300"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
