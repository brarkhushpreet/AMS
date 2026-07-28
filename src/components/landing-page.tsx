"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import {
  ArrowDownRight,
  ArrowRight,
  BarChart3,
  Check,
  FileSpreadsheet,
  Fingerprint,
  LocateFixed,
  RadioTower,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Waves,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { PresenceVisualizer } from "@/components/attendance/presence-visualizer";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

const capabilities = [
  {
    number: "01",
    icon: LocateFixed,
    eyebrow: "Fast",
    title: "Location, with context.",
    copy: "Set a room radius, see accuracy, and keep check-in friction close to zero.",
    color: "text-cyan-700 dark:text-cyan-300",
    surface: "bg-cyan-300/25 dark:bg-cyan-300/10",
  },
  {
    number: "02",
    icon: Waves,
    eyebrow: "Strict",
    title: "A signal that won’t sit still.",
    copy: "Live ultrasonic challenges rotate every second, making copied tones expire immediately.",
    color: "text-violet-700 dark:text-violet-300",
    surface: "bg-violet-300/25 dark:bg-violet-300/10",
  },
  {
    number: "03",
    icon: BarChart3,
    eyebrow: "Useful",
    title: "Patterns, not paperwork.",
    copy: "Class-level and student-level analytics reveal where attendance needs attention.",
    color: "text-emerald-700 dark:text-emerald-300",
    surface: "bg-emerald-300/25 dark:bg-emerald-300/10",
  },
  {
    number: "04",
    icon: FileSpreadsheet,
    eyebrow: "Instant",
    title: "A whole roster in one drop.",
    copy: "Import CSV data with names, registration numbers, classes, and batches in one pass.",
    color: "text-amber-700 dark:text-amber-300",
    surface: "bg-amber-300/25 dark:bg-amber-300/10",
  },
];

const marquee = [
  "teacher-owned classrooms",
  "rotating ultrasound",
  "live geolocation",
  "student analytics",
  "CSV rosters",
  "no admin bottleneck",
];

export function LandingPage() {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.42], [0, 110]);
  const heroRotate = useTransform(scrollYProgress, [0, 0.4], [0, -3]);

  return (
    <main className="paper-noise relative min-h-screen overflow-hidden bg-[#f2f1eb] text-[#111614] transition-colors dark:bg-[#0d1110] dark:text-[#f4f2e9]">
      <nav className="fixed inset-x-0 top-0 z-50">
        <div className="mx-auto mt-3 flex h-14 max-w-[94rem] items-center justify-between rounded-full border border-black/8 bg-[#f9f8f2]/86 px-3 pl-5 shadow-[0_12px_40px_-28px_rgba(12,20,16,.55)] backdrop-blur-xl sm:mt-5 sm:px-4 sm:pl-6 dark:border-white/10 dark:bg-[#151b18]/82">
          <BrandLogo />
          <div className="hidden items-center gap-7 text-[0.72rem] font-bold tracking-wide text-black/50 lg:flex dark:text-white/50">
            <a href="#product" className="hover:text-black dark:hover:text-white">
              The product
            </a>
            <a href="#how" className="hover:text-black dark:hover:text-white">
              How it moves
            </a>
            <a href="#proof" className="hover:text-black dark:hover:text-white">
              Presence proof
            </a>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Link
              href="/auth/login"
              className="hidden rounded-full px-4 py-2 text-xs font-bold text-black/65 hover:bg-black/5 hover:text-black sm:inline-flex dark:text-white/65 dark:hover:bg-white/8 dark:hover:text-white"
            >
              Log in
            </Link>
            <Link
              href="/auth/signup"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-[#151a17] px-4 text-xs font-extrabold text-white hover:-translate-y-0.5 hover:bg-black dark:bg-[#b5f44b] dark:text-[#172008] dark:hover:bg-[#c5ff62]"
            >
              Start now
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative min-h-[48rem] px-5 pb-20 pt-32 sm:px-8 sm:pt-40 lg:min-h-screen lg:px-12">
        <div className="absolute left-[8%] top-[18%] size-52 rounded-full bg-[#b5f44b]/17 blur-[90px] dark:bg-[#b5f44b]/8" />
        <div className="absolute right-[5%] top-[10%] size-72 rounded-full bg-cyan-300/15 blur-[120px] dark:bg-cyan-300/8" />

        <div className="mx-auto grid max-w-[94rem] gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
          <div className="relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-7 flex items-center gap-3"
            >
              <span className="editorial-label text-emerald-800 dark:text-lime-300">
                Classroom presence / 2026
              </span>
              <span className="h-px w-12 bg-black/20 dark:bg-white/20" />
              <span className="text-[0.65rem] font-semibold text-black/40 dark:text-white/40">
                Built for the moment
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.08 }}
              className="max-w-[57rem] text-[clamp(4rem,9.2vw,9rem)] leading-[0.77] font-black tracking-[-0.085em]"
            >
              Presence
              <span className="block pl-[0.07em] font-serif text-[0.86em] font-normal tracking-[-0.06em] italic text-emerald-700 dark:text-lime-300">
                you can feel.
              </span>
            </motion.h1>

            <div className="mt-10 grid max-w-2xl gap-8 border-t border-black/12 pt-6 sm:grid-cols-[1fr_auto] sm:items-end dark:border-white/12">
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35, duration: 0.7 }}
                className="max-w-xl text-base leading-7 text-black/58 sm:text-lg dark:text-white/58"
              >
                Attendance that moves at classroom speed. Start a session,
                verify the room, and understand the pattern—without an admin
                layer slowing everyone down.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.42 }}
              >
                <a
                  href="#product"
                  className="group grid size-16 place-items-center rounded-full border border-black/16 hover:rotate-[-8deg] hover:border-black/40 dark:border-white/18 dark:hover:border-white/50"
                  aria-label="Explore ClassPulse"
                >
                  <ArrowDownRight className="size-5 transition-transform group-hover:translate-x-0.5 group-hover:translate-y-0.5" />
                </a>
              </motion.div>
            </div>
          </div>

          <motion.div
            style={{ y: heroY, rotate: heroRotate }}
            initial={{ opacity: 0, x: 35, rotate: 3 }}
            animate={{ opacity: 1, x: 0, rotate: 0 }}
            transition={{ duration: 0.9, delay: 0.18 }}
            className="relative mx-auto w-full max-w-[38rem] lg:mb-4"
          >
            <div className="absolute -left-6 top-8 z-10 rounded-full border border-black/8 bg-[#b5f44b] px-4 py-2 text-[0.66rem] font-black tracking-[0.14em] text-[#172008] uppercase shadow-lg shadow-lime-900/10">
              Live room 03
            </div>
            <div className="rotate-[2deg] rounded-[2.2rem] border border-black/10 bg-[#151a18] p-3 shadow-[0_45px_90px_-45px_rgba(10,25,20,.58)] dark:border-white/10">
              <PresenceVisualizer
                method="ULTRASOUND"
                active
                frequency={18_240}
              />
              <div className="grid grid-cols-3 gap-2 px-2 pb-2 pt-4 text-white">
                {[
                  ["43", "present"],
                  ["05:00", "window"],
                  ["1.1 s", "hop rate"],
                ].map(([value, label]) => (
                  <div key={label} className="border-l border-white/12 pl-3">
                    <p className="font-mono text-sm font-bold">{value}</p>
                    <p className="mt-1 text-[0.58rem] font-bold tracking-wider text-white/35 uppercase">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <motion.div
              animate={{ y: [0, -7, 0], rotate: [-3, -1, -3] }}
              transition={{ duration: 5, repeat: Number.POSITIVE_INFINITY }}
              className="absolute -bottom-7 -right-3 rounded-2xl border border-black/8 bg-[#faf9f4] p-4 shadow-xl dark:border-white/10 dark:bg-[#202823]"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-cyan-300/25 text-cyan-800 dark:text-cyan-200">
                  <Fingerprint className="size-4" />
                </span>
                <div>
                  <p className="text-xs font-extrabold">Room verified</p>
                  <p className="mt-0.5 text-[0.62rem] text-black/40 dark:text-white/40">
                    6 live challenges matched
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <div className="overflow-hidden border-y border-black/10 bg-[#b5f44b] py-3 text-[#172008] dark:border-white/10">
        <div className="marquee-track flex w-max items-center">
          {[...marquee, ...marquee].map((item, index) => (
            <div
              key={`${item}-${index}`}
              className="flex items-center whitespace-nowrap"
            >
              <span className="px-7 text-[0.68rem] font-black tracking-[0.16em] uppercase">
                {item}
              </span>
              <Sparkles className="size-3.5" />
            </div>
          ))}
        </div>
      </div>

      <section id="product" className="px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
        <div className="mx-auto max-w-[94rem]">
          <div className="grid gap-8 border-b border-black/12 pb-12 lg:grid-cols-[0.7fr_1.3fr] dark:border-white/12">
            <p className="editorial-label text-black/40 dark:text-white/40">
              01 / The product
            </p>
            <h2 className="max-w-4xl text-4xl leading-[0.98] font-black tracking-[-0.055em] sm:text-6xl lg:text-7xl">
              Serious verification.
              <span className="font-serif font-normal italic text-black/35 dark:text-white/38">
                {" "}
                Zero institutional drag.
              </span>
            </h2>
          </div>

          <div className="divide-y divide-black/10 dark:divide-white/10">
            {capabilities.map((feature, index) => (
              <motion.article
                key={feature.title}
                initial={{ opacity: 0, y: 26 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-90px" }}
                transition={{ delay: index * 0.06 }}
                className="group grid gap-5 py-8 sm:grid-cols-[4rem_4rem_0.8fr_1.2fr] sm:items-center lg:py-11"
              >
                <span className="font-mono text-xs text-black/32 dark:text-white/32">
                  {feature.number}
                </span>
                <span
                  className={cn(
                    "grid size-11 place-items-center rounded-full transition-transform duration-500 group-hover:rotate-[-10deg] group-hover:scale-110",
                    feature.surface,
                    feature.color,
                  )}
                >
                  <feature.icon className="size-4.5" />
                </span>
                <div>
                  <p className={cn("editorial-label", feature.color)}>
                    {feature.eyebrow}
                  </p>
                  <h3 className="mt-2 text-2xl font-black tracking-[-0.035em]">
                    {feature.title}
                  </h3>
                </div>
                <p className="max-w-lg text-sm leading-6 text-black/52 sm:ml-auto dark:text-white/52">
                  {feature.copy}
                </p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="bg-[#141a17] px-5 py-24 text-white sm:px-8 lg:px-12 lg:py-32 dark:bg-[#f0eee5] dark:text-[#111614]">
        <div className="mx-auto max-w-[94rem]">
          <div className="grid gap-14 lg:grid-cols-[0.78fr_1.22fr]">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <p className="editorial-label text-lime-300 dark:text-emerald-700">
                02 / How it moves
              </p>
              <h2 className="mt-5 max-w-xl text-5xl leading-[0.91] font-black tracking-[-0.06em] sm:text-7xl">
                Three moves.
                <span className="block font-serif font-normal italic text-white/35 dark:text-black/35">
                  One clear room.
                </span>
              </h2>
              <p className="mt-7 max-w-md text-sm leading-7 text-white/50 dark:text-black/52">
                ClassPulse stays intentionally small: classrooms belong to
                teachers, students join them, and every session creates useful
                evidence.
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  step: "A",
                  title: "Open the classroom",
                  copy: "Create the subject, term, and section. Share a join code or import the full roster.",
                  icon: UsersRound,
                },
                {
                  step: "B",
                  title: "Choose the proof",
                  copy: "Use location when speed matters. Use rotating ultrasound when the room must be certain.",
                  icon: RadioTower,
                },
                {
                  step: "C",
                  title: "Read the pattern",
                  copy: "See live participation, class trends, and individual student history without exporting a sheet.",
                  icon: BarChart3,
                },
              ].map((item, index) => (
                <motion.article
                  key={item.step}
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ x: 6 }}
                  className="grid gap-5 rounded-[1.7rem] border border-white/10 bg-white/[0.055] p-5 sm:grid-cols-[3rem_1fr_auto] sm:items-center sm:p-7 dark:border-black/10 dark:bg-black/[0.035]"
                >
                  <span className="grid size-10 place-items-center rounded-full border border-white/15 font-mono text-xs dark:border-black/15">
                    {item.step}
                  </span>
                  <div>
                    <h3 className="text-xl font-extrabold tracking-tight">
                      {item.title}
                    </h3>
                    <p className="mt-2 max-w-lg text-sm leading-6 text-white/45 dark:text-black/48">
                      {item.copy}
                    </p>
                  </div>
                  <item.icon className="hidden size-6 text-lime-300 sm:block dark:text-emerald-700" />
                </motion.article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="proof" className="px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
        <div className="mx-auto max-w-[94rem]">
          <div className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-[2rem] border border-black/10 bg-[#e8f7f4] p-4 dark:border-white/10 dark:bg-[#101a19]">
              <PresenceVisualizer method="GEOLOCATION" active />
              <div className="p-3 pb-2 pt-6 sm:p-6 sm:pb-4">
                <p className="editorial-label text-cyan-800 dark:text-cyan-300">
                  Flexible proof
                </p>
                <h3 className="mt-3 text-3xl font-black tracking-[-0.045em]">
                  The room becomes a field.
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-black/50 dark:text-white/50">
                  Fresh device coordinates are measured against the teacher’s
                  classroom center and chosen radius.
                </p>
              </div>
            </article>
            <article className="rounded-[2rem] border border-black/10 bg-[#eeeafb] p-4 dark:border-white/10 dark:bg-[#191622]">
              <PresenceVisualizer
                method="ULTRASOUND"
                active
                frequency={17_860}
                progress={4}
                required={6}
              />
              <div className="p-3 pb-2 pt-6 sm:p-6 sm:pb-4">
                <p className="editorial-label text-violet-800 dark:text-violet-300">
                  Strict proof
                </p>
                <h3 className="mt-3 text-3xl font-black tracking-[-0.045em]">
                  Every second is a new answer.
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-black/50 dark:text-white/50">
                  Teacher and student clients follow the same live frequency
                  sequence. Old recordings fall out of sync.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="px-5 pb-8 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[94rem] overflow-hidden rounded-[2.25rem] bg-[#b5f44b] px-6 py-12 text-[#172008] sm:px-10 lg:px-14 lg:py-16">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <p className="editorial-label">Ready when the room is</p>
              <h2 className="mt-4 max-w-4xl text-5xl leading-[0.88] font-black tracking-[-0.065em] sm:text-7xl">
                Make attendance
                <span className="font-serif font-normal italic"> disappear.</span>
              </h2>
            </div>
            <div className="lg:justify-self-end">
              <p className="max-w-sm text-sm leading-6 text-[#172008]/65">
                Create your first classroom, invite students, and run a live
                check-in in minutes.
              </p>
              <Link
                href="/auth/signup"
                className="mt-6 inline-flex h-13 items-center gap-3 rounded-full bg-[#151a17] px-6 text-sm font-extrabold text-white hover:-translate-y-1 hover:shadow-xl"
              >
                Create a classroom
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="px-5 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[94rem] flex-col gap-5 border-t border-black/10 pt-7 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
          <BrandLogo />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.68rem] font-semibold text-black/42 dark:text-white/42">
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-3 text-emerald-600 dark:text-lime-300" />
              Teacher + student only
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3 text-violet-600 dark:text-violet-300" />
              Privacy-aware verification
            </span>
          </div>
          <p className="text-[0.65rem] text-black/35 dark:text-white/35">
            © 2026 ClassPulse
          </p>
        </div>
      </footer>
    </main>
  );
}
