"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import { AudioLines, MapPin, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type CompanionMood = "curious" | "shy" | "error" | "happy";

export const AUTH_COMPANION_EVENT = "classpulse:auth-companion";

export function notifyAuthCompanion(mood: CompanionMood) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(AUTH_COMPANION_EVENT, { detail: { mood } }),
  );
}

export function AuthCompanion() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [mood, setMood] = useState<CompanionMood>("curious");
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const pupilX = useSpring(x, { stiffness: 240, damping: 22 });
  const pupilY = useSpring(y, { stiffness: 240, damping: 22 });

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect || mood === "shy") return;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      x.set(Math.max(-8, Math.min(8, (event.clientX - centerX) / 35)));
      y.set(Math.max(-6, Math.min(6, (event.clientY - centerY) / 45)));
    };
    const onMood = (event: Event) => {
      const custom = event as CustomEvent<{ mood?: CompanionMood }>;
      if (custom.detail?.mood) setMood(custom.detail.mood);
    };
    window.addEventListener("pointermove", onPointer);
    window.addEventListener(AUTH_COMPANION_EVENT, onMood);
    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener(AUTH_COMPANION_EVENT, onMood);
    };
  }, [mood, x, y]);

  useEffect(() => {
    if (mood !== "error") return;
    const timer = window.setTimeout(() => setMood("curious"), 1800);
    return () => window.clearTimeout(timer);
  }, [mood]);

  const copy = {
    curious: ["Presence, made visible.", "I follow the room, not the roll call."],
    shy: ["Your secret stays yours.", "I’ll look away while you type."],
    error: ["That didn’t line up.", "Check the details and give it another go."],
    happy: ["You’re all set.", "Let’s get you back to class."],
  }[mood];

  return (
    <div ref={stageRef} className="relative flex min-h-[31rem] flex-col">
      <div className="flex items-center justify-between text-[0.65rem] font-bold tracking-[0.18em] text-white/50 uppercase">
        <span>Live presence field</span>
        <span className="inline-flex items-center gap-2">
          <span className="size-1.5 animate-pulse rounded-full bg-lime-300" />
          observing
        </span>
      </div>

      <div className="relative my-auto grid place-items-center py-12">
        <motion.div
          animate={
            mood === "error"
              ? { x: [-7, 7, -5, 5, 0], rotate: [-2, 2, -1, 1, 0] }
              : mood === "shy"
                ? { y: [0, 4, 0], rotate: [0, 1.5, 0] }
                : mood === "happy"
                  ? { y: [0, -12, 0], rotate: [0, -2, 2, 0] }
                  : { y: [0, -8, 0] }
          }
          transition={
            mood === "error"
              ? { duration: 0.42 }
              : {
                  duration: mood === "happy" ? 1.15 : 5,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                }
          }
          className={cn(
            "relative grid h-44 w-72 place-items-center rounded-[5.5rem] border transition-colors duration-500",
            mood === "error"
              ? "border-rose-300/50 bg-rose-300/12"
              : "border-white/12 bg-white/[0.055]",
          )}
        >
          <div className="absolute inset-3 rounded-[4.8rem] border border-white/7" />
          <div className="relative flex gap-5 pt-5">
            {[0, 1].map((eye) => (
              <div
                key={eye}
                className="relative"
              >
                <motion.span
                  animate={
                    mood === "shy"
                      ? { y: 7, rotate: eye === 0 ? 16 : -16, width: 42 }
                      : mood === "error"
                        ? { y: 1, rotate: eye === 0 ? -14 : 14, width: 38 }
                        : { y: 0, rotate: eye === 0 ? -5 : 5, width: 34 }
                  }
                  className="absolute -top-5 left-1/2 z-20 h-1 -translate-x-1/2 rounded-full bg-white/55 shadow-[0_0_10px_rgba(255,255,255,.08)]"
                />
                <div className="relative grid h-21 w-18 place-items-center overflow-hidden rounded-[50%] bg-[#f7f1e7] shadow-[inset_0_-8px_18px_rgba(16,21,24,.12)]">
                  <motion.span
                    style={{ x: pupilX, y: pupilY }}
                    animate={
                      mood === "shy"
                        ? { scale: 0.7, opacity: 0 }
                        : mood === "error"
                          ? { scale: [1, 0.78, 1], opacity: 1 }
                          : { scale: 1, opacity: 1 }
                    }
                    className="relative grid size-8 place-items-center rounded-full bg-[#13191d]"
                  >
                    <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-white/80" />
                  </motion.span>
                  <motion.span
                    initial={false}
                    animate={{ scaleY: mood === "shy" ? 1 : 0 }}
                    transition={{ duration: 0.24, ease: "easeOut" }}
                    className="absolute inset-0 origin-top bg-[#171d22]"
                  />
                  <motion.span
                    initial={false}
                    animate={{
                      opacity: mood === "shy" ? 1 : 0,
                      scaleX: mood === "shy" ? 1 : 0.6,
                    }}
                    className="absolute left-1/2 top-1/2 z-10 h-3 w-10 -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-b-2 border-white/70"
                  />
                </div>
              </div>
            ))}
          </div>
          <motion.span
            initial={false}
            animate={{
              opacity: mood === "shy" || mood === "happy" ? 0.75 : 0,
              scale: mood === "shy" || mood === "happy" ? 1 : 0.5,
            }}
            className="absolute bottom-9 left-[4.1rem] size-3 rounded-full bg-rose-300/55 blur-[1px]"
          />
          <motion.span
            initial={false}
            animate={{
              opacity: mood === "shy" || mood === "happy" ? 0.75 : 0,
              scale: mood === "shy" || mood === "happy" ? 1 : 0.5,
            }}
            className="absolute bottom-9 right-[4.1rem] size-3 rounded-full bg-rose-300/55 blur-[1px]"
          />

          <motion.div
            key={mood}
            initial={{ opacity: 0, scale: 0.7, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 330, damping: 23 }}
            className="absolute bottom-7 left-1/2 grid h-8 w-16 -translate-x-1/2 place-items-center"
          >
            {mood === "curious" && (
              <span className="h-3 w-7 rounded-b-full border-b-[3px] border-white/45" />
            )}
            {mood === "shy" && (
              <span className="h-4 w-9 rounded-b-full border-b-[3px] border-rose-200/80" />
            )}
            {mood === "error" && (
              <span className="mt-3 h-4 w-8 rounded-t-full border-t-[3px] border-rose-300" />
            )}
            {mood === "happy" && (
              <span className="relative h-7 w-12 overflow-hidden rounded-b-[1.5rem] border border-white/65 bg-[#080b09] shadow-[0_5px_15px_rgba(0,0,0,.22)]">
                <span className="absolute inset-x-1 top-0 h-2 rounded-b-lg bg-[#f7f1e7]" />
                <span className="absolute bottom-0 left-1/2 h-2.5 w-7 -translate-x-1/2 rounded-t-full bg-rose-300/85" />
              </span>
            )}
          </motion.div>
        </motion.div>

        <div className="pointer-events-none absolute inset-0">
          <span className="absolute left-[11%] top-[20%] size-2 rounded-full bg-cyan-300 shadow-[0_0_22px_5px_rgba(103,232,249,.35)]" />
          <span className="absolute bottom-[23%] right-[12%] size-2.5 rounded-full bg-lime-300 shadow-[0_0_25px_5px_rgba(190,242,100,.3)]" />
          <span className="absolute right-[18%] top-[9%] size-1.5 rounded-full bg-violet-300" />
        </div>
      </div>

      <motion.div
        key={mood}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <p className="font-serif text-3xl leading-tight tracking-[-0.03em] text-white">
          {copy[0]}
        </p>
        <p className="mt-2 max-w-sm text-sm leading-6 text-white/50">{copy[1]}</p>
      </motion.div>

      <div className="mt-8 grid grid-cols-3 gap-2 border-t border-white/10 pt-5">
        {[
          [MapPin, "Room radius", "cyan"],
          [AudioLines, "Live signal", "violet"],
          [ShieldCheck, "Private", "lime"],
        ].map(([Icon, label, color]) => {
          const ItemIcon = Icon as typeof MapPin;
          return (
            <div key={label as string} className="flex items-center gap-2 text-[0.68rem] font-bold text-white/55">
              <ItemIcon
                className={cn(
                  "size-3.5",
                  color === "cyan"
                    ? "text-cyan-300"
                    : color === "violet"
                      ? "text-violet-300"
                      : "text-lime-300",
                )}
              />
              {label as string}
            </div>
          );
        })}
      </div>
    </div>
  );
}
