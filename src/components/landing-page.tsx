"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, BarChart3, CheckCheck, ChevronRight, Fingerprint, MapPin, RadioTower, ShieldCheck, UsersRound, Waves } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { PresenceVisualizer } from "@/components/attendance/presence-visualizer";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const features = [
  { icon: UsersRound, title: "Your classroom, your workflow", copy: "Create a room, share a join code, or import your roster. Teachers and students get exactly the tools they need." },
  { icon: BarChart3, title: "A clearer picture of attendance", copy: "Explore trends, filter session history, and look closer at individual students without losing the class context." },
  { icon: ShieldCheck, title: "A record you can verify", copy: "Close a session with a signed attendance receipt. Share it or download the report for independent verification." },
];

export function LandingPage() {
  const [method, setMethod] = useState<"GEOLOCATION" | "ULTRASOUND">("ULTRASOUND");
  const reducedMotion = useReducedMotion();
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <nav aria-label="Main navigation" className="mx-auto flex h-18 max-w-[1440px] items-center justify-between gap-6 px-5 sm:px-10 lg:px-14">
          <BrandLogo />
          <div className="hidden items-center gap-7 text-sm text-[var(--muted)] md:flex">
            <a href="#product" className="hover:text-[var(--foreground)]">Product</a>
            <a href="#verification" className="hover:text-[var(--foreground)]">Verification</a>
            <a href="#workflow" className="hover:text-[var(--foreground)]">How it works</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <ThemeToggle className="size-9" />
            <Link href="/auth/login" className="text-sm font-medium">Log in</Link>
            <Link href="/auth/signup" className={cn(buttonVariants({ size: "sm", variant: "brand" }), "hidden sm:inline-flex")}>Get started <ArrowRight className="size-3.5" /></Link>
          </div>
        </nav>
      </header>
      <section className="mx-auto grid max-w-[1440px] items-center gap-12 px-5 py-16 sm:px-10 sm:py-24 lg:grid-cols-[.9fr_1.1fr] lg:gap-16 lg:px-14 lg:py-28">
        <motion.div initial={reducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4 }}>
          <p className="mb-6 flex items-center gap-2 text-xs font-medium tracking-wide text-[var(--accent)]"><RadioTower className="size-4" /> A little less roll call. A lot more clarity.</p>
          <h1 className="max-w-xl text-[clamp(2.8rem,4.8vw,4.4rem)] leading-[1.06] font-semibold tracking-[-.055em]">Be present.<br /><span className="text-[var(--muted)]">We’ll keep the record.</span></h1>
          <p className="mt-7 max-w-md text-base leading-7 text-[var(--muted)]">A thoughtful attendance workspace for teachers and students. Check in with location or a changing room signal, and turn every session into a clear, verifiable record.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/auth/signup" className={buttonVariants({ variant: "brand", size: "lg" })}>Create your classroom <ArrowRight className="size-4" /></Link>
            <Link href="/auth/login" className={buttonVariants({ variant: "secondary", size: "lg" })}>Student sign in</Link>
          </div>
          <p className="mt-5 text-xs text-[var(--muted)]">Two roles. One shared view of attendance.</p>
        </motion.div>
        <motion.div initial={reducedMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5, delay: .1 }} className="overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-soft">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3 text-xs text-[var(--muted)]"><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[var(--accent)]" /> ClassPulse workspace</span><span>Interactive preview</span></div>
          <div className="p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs text-[var(--muted)]">CS 201 / Section A</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Computer networks</h2></div><span className="rounded-md bg-[var(--accent-soft)] px-2 py-1 text-xs text-[var(--accent)]">Demo session</span></div>
            <div className="my-5 flex gap-1 border-b border-[var(--border)]" aria-label="Preview attendance method">
              {(["ULTRASOUND", "GEOLOCATION"] as const).map(value => <button key={value} aria-pressed={method === value} onClick={() => setMethod(value)} className={cn("border-b-2 px-3 pb-3 text-xs font-medium", method === value ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--muted)]")}>{value === "ULTRASOUND" ? "Room signal" : "Location"}</button>)}
            </div>
            <PresenceVisualizer method={method} active compact frequency={18_200} progress={method === "ULTRASOUND" ? 3 : undefined} required={method === "ULTRASOUND" ? 4 : undefined} />
            <div className="mt-5 grid grid-cols-3 divide-x divide-[var(--border)]">
              {[["32 / 36", "Checked in"], ["89%", "Participation"], ["04:28", "Time remaining"]].map(([value, label], i) => <div key={label} className={i ? "pl-4" : ""}><p className="text-lg font-semibold tabular-nums">{value}</p><p className="mt-1 text-[11px] text-[var(--muted)]">{label}</p></div>)}
            </div>
            <div className="mt-6 flex items-center gap-3 rounded-lg bg-[var(--surface-soft)] px-3 py-3"><CheckCheck className="size-4 text-emerald-600 dark:text-emerald-300" /><p className="text-xs text-[var(--muted)]">Presence captured. Passkey confirmed.</p></div>
          </div>
        </motion.div>
      </section>
      <section id="product" className="border-y border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto grid max-w-[1440px] gap-8 px-5 py-12 sm:px-10 md:grid-cols-3 lg:gap-14 lg:px-14">
          {features.map((feature, index) => <article key={feature.title}><feature.icon className={cn("mb-5 size-5", ["text-blue-600 dark:text-blue-300", "text-violet-600 dark:text-violet-300", "text-emerald-700 dark:text-emerald-300"][index])} /><h2 className="text-base font-semibold tracking-tight">{feature.title}</h2><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{feature.copy}</p></article>)}
        </div>
      </section>
      <section id="verification" className="mx-auto grid max-w-[1440px] gap-10 px-5 py-20 sm:px-10 lg:grid-cols-[.8fr_1.2fr] lg:gap-20 lg:px-14">
        <div><p className="editorial-label text-[var(--accent)]">Made for the room</p><h2 className="mt-4 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Choose how<br />your class checks in.</h2><p className="mt-5 max-w-sm text-sm leading-7 text-[var(--muted)]">Different rooms and devices call for different methods. Keep the decision simple, with clear limits and feedback along the way.</p></div>
        <div className="divide-y divide-[var(--border)]">
          {[{ icon: MapPin, title: "Location check-in", text: "A fresh position is checked against your classroom radius. Convenient for everyday sessions, with accuracy shown clearly." }, { icon: Waves, title: "A changing acoustic signal", text: "Students listen for a short sequence played in the room. Expected frequencies stay on the server and teacher device. Hardware and room conditions affect detection." }, { icon: Fingerprint, title: "An extra confirmation", text: "Students can confirm attendance with a passkey. It adds account verification without sending biometric data to ClassPulse." }].map(item => <article key={item.title} className="flex gap-5 py-6 first:pt-0"><span className="mt-1 grid size-10 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface)]"><item.icon className="size-4 text-[var(--accent)]" /></span><div><h3 className="font-semibold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.text}</p></div></article>)}
          <p className="pt-5 text-xs leading-5 text-[var(--muted)]">Acoustic and location checks support attendance decisions. They cannot guarantee physical identity or prevent a sophisticated live relay.</p>
        </div>
      </section>
      <section id="workflow" className="border-y border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-10 lg:px-14">
          <p className="editorial-label text-[var(--muted)]">From roster to record</p><h2 className="mb-10 mt-3 text-3xl font-semibold tracking-[-.04em]">Ready for the next class.</h2>
          <div className="grid gap-8 md:grid-cols-3">{[{ title: "Bring your class together", copy: "Share a join code or upload a CSV roster with names, registration numbers, and batches." }, { title: "Open a check-in window", copy: "Choose the method, start the session, and let students confirm their attendance." }, { title: "Keep a useful history", copy: "Review participation, inspect individual records, and share a signed session receipt." }].map((step, index) => <div key={step.title} className="border-t border-[var(--border)] pt-5"><span className="font-mono text-xs text-[var(--accent)]">0{index + 1}</span><h3 className="mt-4 font-semibold">{step.title}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">{step.copy}</p></div>)}</div>
        </div>
      </section>
      <section className="mx-auto flex max-w-[1440px] flex-col justify-between gap-7 px-5 py-16 sm:px-10 md:flex-row md:items-center lg:px-14"><div><h2 className="text-2xl font-semibold tracking-tight">More time for the class itself.</h2><p className="mt-2 text-sm text-[var(--muted)]">Your next session starts with a classroom.</p></div><Link href="/auth/signup" className={buttonVariants({ variant: "brand", size: "lg" })}>Get started <ChevronRight className="size-4" /></Link></section>
      <footer className="border-t border-[var(--border)]"><div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-5 px-5 py-7 text-xs text-[var(--muted)] sm:px-10 lg:px-14"><BrandLogo /><span>Built around classroom presence.</span><Link href="/auth/login">Open your workspace ↗</Link></div></footer>
    </main>
  );
}
