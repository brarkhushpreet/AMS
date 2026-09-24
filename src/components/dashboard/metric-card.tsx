import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  blue:
    "bg-cyan-300/20 text-cyan-800 ring-cyan-700/8 dark:bg-cyan-300/10 dark:text-cyan-300 dark:ring-cyan-300/10",
  violet:
    "bg-violet-300/20 text-violet-800 ring-violet-700/8 dark:bg-violet-300/10 dark:text-violet-300 dark:ring-violet-300/10",
  emerald:
    "bg-emerald-300/20 text-emerald-800 ring-emerald-700/8 dark:bg-blue-300/10 dark:text-blue-300 dark:ring-lime-300/10",
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
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-[var(--muted)]">
            {label}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums text-[var(--foreground)]">
            {value}
          </p>
        </div>
        <span
          className={cn(
            "grid size-11 place-items-center rounded-2xl ring-1 transition-transform ",
            tones[tone],
          )}
        >
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-4 text-[0.68rem] font-semibold text-slate-500 dark:text-white/60">{detail}</p>
    </article>
  );
}
