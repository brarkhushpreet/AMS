"use client";

import { motion, useReducedMotion } from "motion/react";
import { LocateFixed, Waves } from "lucide-react";
import { cn } from "@/lib/utils";

export function PresenceVisualizer({ method, active = false, frequency, progress, required, compact = false }: {
  method: "GEOLOCATION" | "ULTRASOUND";
  active?: boolean;
  frequency?: number | null;
  progress?: number;
  required?: number;
  compact?: boolean;
}) {
  const reduced = useReducedMotion();
  const animate = active && !reduced;
  const location = method === "GEOLOCATION";
  const bars = [12, 20, 34, 24, 48, 36, 62, 46, 72, 54, 40, 60, 34, 48, 26, 36, 18, 10];
  return (
    <div className={cn("presence-canvas relative isolate overflow-hidden rounded-xl border border-[var(--presence-line)]", compact ? "h-48" : "h-60")}>
      <div aria-hidden="true" className="presence-canvas-grid pointer-events-none absolute inset-x-0 top-12 bottom-10 -z-10" />
      <div className="absolute inset-x-4 top-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-medium text-[var(--foreground)]">
          <span className="grid size-6 place-items-center rounded-md border border-[var(--presence-line)] bg-[var(--presence-base)] text-[var(--accent)]">
            {location ? <LocateFixed className="size-3.5" /> : <Waves className="size-3.5" />}
          </span>
          {location ? "Classroom radius" : "Room signal"}
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-[var(--presence-line)] bg-[var(--presence-base)] px-2 py-1 text-[10px] font-medium text-[var(--muted)]">
          {active && <span className="size-1.5 rounded-full bg-[var(--accent)]" />}
          {active ? "Active session" : "Preview"}
        </span>
      </div>

      <div aria-hidden="true" className="absolute inset-x-4 top-11 bottom-11 flex items-center justify-center">
        {location ? (
          <div className="relative grid h-full w-full max-w-72 place-items-center">
            <svg viewBox="0 0 288 150" className="absolute h-full w-full text-[var(--presence-line)]" fill="none">
              <path d="M0 32H78V0M210 0V35H288M0 117H74V150M215 150V114H288M32 0V150M257 0V150" stroke="currentColor" strokeWidth="1.5" />
              <path d="M0 75H288M144 0V150" stroke="currentColor" strokeDasharray="3 6" />
            </svg>
            <div className={cn("relative grid place-items-center rounded-full border border-dashed border-[var(--accent)]/45 bg-[var(--accent)]/[0.035]", compact ? "size-24" : "size-32")}>
              <div className="absolute inset-4 rounded-full border border-[var(--accent)]/20" />
              <motion.div animate={animate ? { scale: [.65, 1.12], opacity: [.4, 0] } : { scale: 1, opacity: .15 }} transition={animate ? { duration: 3, repeat: Infinity } : { duration: 0 }} className="absolute inset-0 rounded-full border border-[var(--accent)]" />
              <span className="relative grid size-10 place-items-center rounded-xl border border-[var(--presence-line)] bg-[var(--presence-base)] text-[var(--accent)] shadow-sm"><LocateFixed className="size-5" /></span>
              <span className="absolute -right-1 top-1/2 size-2 rounded-full border-2 border-[var(--presence-base)] bg-[var(--accent)]" />
            </div>
          </div>
        ) : (
          <div className="relative flex h-full w-full max-w-80 items-center justify-center">
            <div className="absolute inset-x-0 top-1/2 h-px bg-[var(--presence-line)]" />
            <div className="relative flex items-center gap-1.5">
              {bars.map((height, index) => (
                <motion.span key={index} className={cn("w-1.5 rounded-full", index > 4 && index < 13 ? "bg-[var(--accent)]" : "bg-[var(--accent)]/45")} style={{ height: height * (compact ? .7 : 1) }} animate={animate ? { scaleY: [.65, 1, .65] } : { scaleY: .85 }} transition={animate ? { duration: 1.8, delay: index * .07, repeat: Infinity } : { duration: 0 }} />
              ))}
            </div>
            <span className="absolute bottom-0 text-[9px] font-medium tracking-[.15em] text-[var(--muted)] uppercase">Frequency sequence</span>
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex min-h-10 items-center justify-between gap-3 border-t border-[var(--presence-line)] bg-[var(--presence-base)] px-4 py-2 text-[11px] text-[var(--muted)]">
        <span>{location ? "Position checked against the room center" : frequency ? (frequency / 1000).toFixed(1) + " kHz · current tone" : active ? "Short-lived tones verify classroom presence" : "A changing sequence, not a reusable tone"}</span>
        {required ? <span className="shrink-0 rounded-md bg-[var(--accent-soft)] px-2 py-0.5 font-mono tabular-nums text-[var(--accent)]">{progress ?? 0} / {required}</span> : null}
      </div>
    </div>
  );
}
