"use client";

import { motion } from "motion/react";
import { AudioLines, LocateFixed, MapPin, RadioTower } from "lucide-react";
import { cn } from "@/lib/utils";

export function PresenceVisualizer({
  method,
  active = false,
  frequency,
  progress,
  required,
  compact = false,
}: {
  method: "GEOLOCATION" | "ULTRASOUND";
  active?: boolean;
  frequency?: number | null;
  progress?: number;
  required?: number;
  compact?: boolean;
}) {
  if (method === "GEOLOCATION") {
    return (
      <div
        className={cn(
          "presence-stage relative isolate overflow-hidden rounded-[1.75rem]",
          compact ? "h-48" : "h-72",
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,rgba(34,211,238,.18),transparent_38%),linear-gradient(145deg,#11191d,#172128)]" />
        <div className="radar-grid absolute inset-0 opacity-40" />
        <div className="absolute left-1/2 top-[55%] size-52 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/12">
          <div className="absolute inset-[18%] rounded-full border border-cyan-200/14" />
          <div className="absolute inset-[37%] rounded-full border border-cyan-200/16" />
          <motion.div
            animate={active ? { rotate: 360 } : { rotate: 35 }}
            transition={
              active
                ? { duration: 3.4, repeat: Number.POSITIVE_INFINITY, ease: "linear" }
                : { duration: 0.8 }
            }
            className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,transparent_295deg,rgba(103,232,249,.26)_345deg,rgba(103,232,249,.04)_360deg)]"
          />
          <span className="absolute left-1/2 top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-cyan-200/25 bg-cyan-300 text-slate-950 shadow-[0_0_40px_8px_rgba(34,211,238,.25)]">
            <LocateFixed className="size-4.5" />
          </span>
          {[
            ["left-[12%] top-[29%]", 0],
            ["right-[8%] top-[48%]", 0.8],
            ["bottom-[8%] left-[32%]", 1.5],
          ].map(([position, delay]) => (
            <motion.span
              key={position as string}
              animate={active ? { scale: [0.7, 1.25, 0.7], opacity: [0.45, 1, 0.45] } : undefined}
              transition={{ duration: 2.4, delay: delay as number, repeat: Number.POSITIVE_INFINITY }}
              className={cn(
                "absolute size-2.5 rounded-full border border-white/50 bg-cyan-300 shadow-[0_0_16px_3px_rgba(103,232,249,.35)]",
                position,
              )}
            />
          ))}
        </div>
        <div className="absolute inset-x-4 bottom-4 flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-white backdrop-blur-md">
          <span className="flex items-center gap-2 text-[0.68rem] font-bold text-white/65">
            <MapPin className="size-3.5 text-cyan-300" />
            Precision room field
          </span>
          <span className="font-mono text-[0.65rem] text-cyan-200">
            {active ? "SCANNING" : "READY"}
          </span>
        </div>
      </div>
    );
  }

  const bars = [18, 35, 58, 30, 75, 46, 88, 52, 70, 28, 64, 40, 80, 34, 56, 22];
  return (
    <div
      className={cn(
        "presence-stage relative isolate overflow-hidden rounded-[1.75rem]",
        compact ? "h-48" : "h-72",
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_52%,rgba(167,139,250,.22),transparent_36%),linear-gradient(145deg,#15151c,#20192d)]" />
      <div className="signal-grid absolute inset-0 opacity-35" />
      <div className="absolute inset-x-6 top-7 flex items-center justify-between text-white">
        <span className="flex items-center gap-2 text-[0.66rem] font-bold tracking-[0.14em] text-white/45 uppercase">
          <RadioTower className="size-3.5 text-violet-300" />
          rotating challenge
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[0.6rem] text-violet-200">
          {active ? "LIVE" : "STANDBY"}
        </span>
      </div>

      <div className="absolute inset-x-6 top-1/2 flex -translate-y-1/2 items-center justify-center gap-1.5">
        {bars.map((height, index) => (
          <motion.span
            key={`${height}-${index}`}
            animate={
              active
                ? {
                    height: [
                      `${Math.max(12, height * 0.45)}px`,
                      `${height}px`,
                      `${Math.max(16, height * 0.62)}px`,
                    ],
                    opacity: [0.45, 1, 0.6],
                  }
                : { height: `${Math.max(10, height * 0.32)}px`, opacity: 0.35 }
            }
            transition={{
              duration: 0.72 + (index % 4) * 0.14,
              repeat: active ? Number.POSITIVE_INFINITY : 0,
              repeatType: "mirror",
              ease: "easeInOut",
            }}
            className="w-1.5 rounded-full bg-linear-to-t from-violet-500 via-fuchsia-300 to-cyan-200 shadow-[0_0_12px_rgba(196,181,253,.35)] sm:w-2"
          />
        ))}
      </div>

      <motion.div
        animate={active ? { x: ["-20%", "120%"] } : { x: "50%" }}
        transition={{ duration: 1.1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
        className="absolute inset-y-0 w-px bg-linear-to-b from-transparent via-white/65 to-transparent shadow-[0_0_18px_4px_rgba(255,255,255,.2)]"
      />

      <div className="absolute inset-x-4 bottom-4 flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-white backdrop-blur-md">
        <span className="flex items-center gap-2 text-[0.68rem] font-bold text-white/65">
          <AudioLines className="size-3.5 text-violet-300" />
          {progress !== undefined && required
            ? `${progress} of ${required} tones matched`
            : "Frequency-hopping proof"}
        </span>
        <motion.span
          key={frequency ?? "idle"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-mono text-[0.7rem] font-bold text-violet-200"
        >
          {frequency ? `${(frequency / 1_000).toFixed(2)} kHz` : "17.20—18.80 kHz"}
        </motion.span>
      </div>
    </div>
  );
}
