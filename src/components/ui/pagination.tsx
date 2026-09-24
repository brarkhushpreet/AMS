import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

function pageItems(current: number, total: number) {
  const items = new Set([1, total, current - 1, current, current + 1]);
  return [...items]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);
}

export function Pagination({
  currentPage,
  totalPages,
  basePath,
  params,
}: {
  currentPage: number;
  totalPages: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  function href(page: number) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) search.set(key, value);
    });
    if (page > 1) search.set("page", String(page));
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  const pages = pageItems(currentPage, totalPages);

  return (
    <nav
      aria-label="Attendance pagination"
      className="flex flex-col gap-3 border-t border-black/6 px-4 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/7"
    >
      <p className="text-[0.68rem] font-semibold text-slate-500 dark:text-white/60">
        Page {currentPage} of {totalPages}
      </p>
      <div className="flex items-center gap-1.5">
        <PageLink
          href={href(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          label="Previous page"
        >
          <ArrowLeft className="size-3.5" />
        </PageLink>
        {pages.map((page, index) => (
          <span key={page} className="flex items-center gap-1.5">
            {index > 0 && page - pages[index - 1] > 1 && (
              <span className="px-1 text-xs text-slate-300 dark:text-white/20">…</span>
            )}
            <Link
              href={href(page)}
              aria-current={page === currentPage ? "page" : undefined}
              className={cn(
                "grid size-9 place-items-center rounded-xl text-xs font-semibold",
                page === currentPage
                  ? "bg-[#151a17] text-white dark:bg-[var(--accent)] dark:text-[var(--accent-ink)]"
                  : "border border-black/8 bg-white/50 text-slate-500 hover:border-black/15 hover:text-slate-900 dark:border-white/8 dark:bg-white/4 dark:text-white/60 dark:hover:border-white/15 dark:hover:text-white",
              )}
            >
              {page}
            </Link>
          </span>
        ))}
        <PageLink
          href={href(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          label="Next page"
        >
          <ArrowRight className="size-3.5" />
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className="grid size-9 place-items-center rounded-xl border border-black/6 text-slate-300 dark:border-white/6 dark:text-white/15"
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className="grid size-9 place-items-center rounded-xl border border-black/8 bg-white/50 text-slate-500 hover:border-black/15 hover:text-slate-900 dark:border-white/8 dark:bg-white/4 dark:text-white/60 dark:hover:border-white/15 dark:hover:text-white"
    >
      {children}
    </Link>
  );
}
