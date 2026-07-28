import Link from "next/link";
import { RadioTower } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandLogo({
  href = "/",
  compact = false,
  className,
}: {
  href?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2.5 font-extrabold tracking-[-0.035em] text-slate-950 dark:text-[#f4f2e9]",
        className,
      )}
      aria-label="ClassPulse home"
    >
      <span className="relative grid size-9 place-items-center rounded-[0.8rem] bg-[#151a17] text-white shadow-lg shadow-emerald-950/15 dark:bg-[#b5f44b] dark:text-[#172008]">
        <RadioTower className="size-4.5" aria-hidden="true" />
        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-[#f2f1eb] bg-cyan-400 dark:border-[#0d1110]" />
      </span>
      {!compact && <span className="text-[1.12rem]">ClassPulse</span>}
    </Link>
  );
}
