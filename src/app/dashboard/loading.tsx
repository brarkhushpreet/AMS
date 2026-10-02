import { LoaderCircle } from "lucide-react";

export default function DashboardLoading() {
  return <div role="status" aria-live="polite" className="space-y-5">
    <div className="flex items-center gap-3 text-sm font-medium text-[var(--muted)]"><LoaderCircle className="size-4 animate-spin text-[var(--accent)] motion-reduce:animate-none" />Loading current data…</div>
    <div className="h-32 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)] motion-reduce:animate-none" />
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)] motion-reduce:animate-none" />)}</div>
    <div className="h-56 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)] motion-reduce:animate-none" />
  </div>;
}
