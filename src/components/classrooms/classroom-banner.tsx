import type { ReactNode } from "react";

/** Decorative architectural lines, shared by teacher and student classrooms. */
export function ClassroomBanner({ children }: { children: ReactNode }) {
  return (
    <section className="classroom-banner relative isolate overflow-hidden rounded-2xl border px-6 py-7 text-[var(--foreground)] sm:px-8">
      <svg aria-hidden="true" viewBox="0 0 660 260" fill="none" className="pointer-events-none absolute inset-y-0 right-0 -z-10 h-full w-[65%] text-[var(--banner-line)]" preserveAspectRatio="xMaxYMid slice">
        <path d="M190 300V155C190 55 290-35 405-35H690M235 300V155C235 80 308 10 405 10H690M280 300V155C280 106 329 55 405 55H690M325 300V155C325 130 351 100 405 100H690" stroke="currentColor" strokeWidth="1.25" />
        <path d="M405-35V300M450-35V300M495-35V300M540-35V300M585-35V300" stroke="currentColor" strokeWidth=".65" strokeDasharray="3 7" opacity=".6" />
        <circle cx="325" cy="155" r="4" fill="currentColor" /><circle cx="495" cy="55" r="4" fill="currentColor" />
      </svg>
      {children}
    </section>
  );
}
