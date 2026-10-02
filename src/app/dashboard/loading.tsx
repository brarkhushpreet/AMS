import { RadioTower } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[calc(100dvh-9rem)] flex-col items-center justify-center gap-5">
      <div className="relative grid size-14 place-items-center">
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)] motion-reduce:animate-none" aria-hidden="true" />
        <RadioTower className="size-5 text-[var(--accent)]" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium tracking-wide text-[var(--muted)]">Loading…</p>
    </div>
  );
}
