import { cn } from "@/lib/utils";

export function StatusPill({
  children,
  tone = "neutral",
  pulse = false,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "blue" | "green" | "amber" | "red" | "violet";
  pulse?: boolean;
}) {
  const tones = {
    neutral: "bg-slate-100 text-slate-600 dark:bg-white/7 dark:text-white/60",
    blue: "bg-cyan-50 text-cyan-800 dark:bg-cyan-300/10 dark:text-cyan-300",
    green: "bg-emerald-50 text-emerald-700 dark:bg-blue-300/10 dark:text-blue-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-300/10 dark:text-amber-300",
    red: "bg-red-50 text-red-700 dark:bg-red-300/10 dark:text-red-300",
    violet: "bg-violet-50 text-violet-700 dark:bg-violet-300/10 dark:text-violet-300",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.72rem] font-semibold",
        tones[tone],
      )}
    >
      {pulse && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {children}
    </span>
  );
}
