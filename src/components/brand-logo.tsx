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
        "inline-flex items-center gap-2.5 font-semibold tracking-[-0.035em] text-slate-950 dark:text-[var(--foreground)]",
        className,
      )}
      aria-label="ClassPulse home"
    >
      <span className="relative grid size-8 place-items-center rounded-lg bg-[var(--accent)] text-[var(--accent-ink)]">
        <RadioTower className="size-4.5" aria-hidden="true" />
      </span>
      {!compact && <span className="text-[1.12rem]">ClassPulse</span>}
    </Link>
  );
}
