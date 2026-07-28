import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  blue:
    "bg-cyan-300/20 text-cyan-800 ring-cyan-700/8 dark:bg-cyan-300/10 dark:text-cyan-300 dark:ring-cyan-300/10",
  violet:
    "bg-violet-300/20 text-violet-800 ring-violet-700/8 dark:bg-violet-300/10 dark:text-violet-300 dark:ring-violet-300/10",
  emerald:
    "bg-emerald-300/20 text-emerald-800 ring-emerald-700/8 dark:bg-lime-300/10 dark:text-lime-300 dark:ring-lime-300/10",
  amber:
    "bg-amber-300/20 text-amber-800 ring-amber-700/8 dark:bg-amber-300/10 dark:text-amber-300 dark:ring-amber-300/10",
};

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
  tone: keyof typeof tones;
}) {
  return (
    <article className="group rounded-[1.35rem] border border-black/8 bg-[#fbfaf5] p-5 shadow-card hover:-translate-y-1 hover:border-black/15 hover:shadow-soft dark:border-white/8 dark:bg-[#151b18] dark:hover:border-white/15">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[0.62rem] font-extrabold tracking-[0.15em] text-slate-400 uppercase dark:text-white/30">
            {label}
          </p>
          <p className="mt-3 text-3xl font-black tracking-[-0.055em] text-slate-950 dark:text-white">
            {value}
          </p>
        </div>
        <span
          className={cn(
            "grid size-11 place-items-center rounded-2xl ring-1 transition-transform group-hover:rotate-3 group-hover:scale-105",
            tones[tone],
          )}
        >
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-4 text-[0.68rem] font-semibold text-slate-500 dark:text-white/38">{detail}</p>
    </article>
  );
}
