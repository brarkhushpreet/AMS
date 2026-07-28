"use client";

import { FormEvent, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Filter,
  LoaderCircle,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { SelectField, type SelectOption } from "@/components/ui/select-field";

type FilterValues = {
  q?: string;
  classroom?: string;
  method?: string;
  status?: string;
  period?: string;
};

const methodOptions: SelectOption[] = [
  { value: "all", label: "Every method" },
  { value: "GEOLOCATION", label: "Location", description: "Room-radius verification" },
  { value: "ULTRASOUND", label: "Ultrasound", description: "Live rotating signal" },
];

const periodOptions: SelectOption[] = [
  { value: "all", label: "All time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

export function AttendanceFilters({
  classrooms = [],
  statusOptions,
  current,
  resultCount,
  showSearch = true,
  showClassroom = true,
}: {
  classrooms?: SelectOption[];
  statusOptions: SelectOption[];
  current: FilterValues;
  resultCount: number;
  showSearch?: boolean;
  showClassroom?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(current.q ?? "");
  const [isPending, startTransition] = useTransition();

  function navigate(next: URLSearchParams) {
    next.delete("page");
    const query = next.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname));
  }

  function setFilter(key: keyof FilterValues, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    navigate(next);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilter("q", search.trim());
  }

  function clearAll() {
    setSearch("");
    startTransition(() => router.push(pathname));
  }

  const classroomOptions: SelectOption[] = [
    { value: "all", label: "Every classroom" },
    ...classrooms,
  ];
  const activeTags = [
    showSearch && current.q
      ? { key: "q" as const, label: `Search: “${current.q}”` }
      : null,
    showClassroom && current.classroom
      ? {
          key: "classroom" as const,
          label:
            classrooms.find((item) => item.value === current.classroom)?.label ??
            "Classroom",
        }
      : null,
    current.method
      ? {
          key: "method" as const,
          label:
            methodOptions.find((item) => item.value === current.method)?.label ??
            current.method,
        }
      : null,
    current.status
      ? {
          key: "status" as const,
          label:
            statusOptions.find((item) => item.value === current.status)?.label ??
            current.status,
        }
      : null,
    current.period
      ? {
          key: "period" as const,
          label:
            periodOptions.find((item) => item.value === current.period)?.label ??
            current.period,
        }
      : null,
  ].filter(Boolean) as Array<{ key: keyof FilterValues; label: string }>;

  return (
    <section className="rounded-[1.5rem] border border-black/8 bg-[#fbfaf5] p-4 shadow-card dark:border-white/8 dark:bg-[#151b18] sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        {showSearch ? (
          <form onSubmit={submitSearch} className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400 dark:text-white/30" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              type="search"
              placeholder="Search classroom or subject code"
              className="h-11 w-full rounded-xl border border-black/10 bg-white/70 pl-10 pr-24 text-xs font-semibold text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/8 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/25"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 inline-flex h-8 -translate-y-1/2 items-center gap-1.5 rounded-lg bg-[#151a17] px-3 text-[0.65rem] font-extrabold text-white hover:bg-black dark:bg-[#b5f44b] dark:text-[#172008]"
            >
              {isPending ? (
                <LoaderCircle className="size-3 animate-spin" />
              ) : (
                <Filter className="size-3" />
              )}
              Search
            </button>
          </form>
        ) : null}

        <div
          className={
            showClassroom
              ? "grid gap-2 sm:grid-cols-2 xl:w-[44rem] xl:grid-cols-4"
              : "grid w-full gap-2 sm:grid-cols-3"
          }
        >
          {showClassroom ? (
            <SelectField
              ariaLabel="Classroom"
              value={current.classroom ?? "all"}
              options={classroomOptions}
              onValueChange={(value) => setFilter("classroom", value)}
            />
          ) : null}
          <SelectField
            ariaLabel="Verification method"
            value={current.method ?? "all"}
            options={methodOptions}
            onValueChange={(value) => setFilter("method", value)}
          />
          <SelectField
            ariaLabel="Attendance status"
            value={current.status ?? "all"}
            options={statusOptions}
            onValueChange={(value) => setFilter("status", value)}
          />
          <SelectField
            ariaLabel="Time period"
            value={current.period ?? "all"}
            options={periodOptions}
            onValueChange={(value) => setFilter("period", value)}
          />
        </div>
      </div>

      <div className="mt-4 flex min-h-8 flex-wrap items-center gap-2 border-t border-black/6 pt-4 dark:border-white/7">
        <span className="mr-1 inline-flex items-center gap-1.5 text-[0.65rem] font-extrabold tracking-wide text-slate-400 uppercase dark:text-white/28">
          <SlidersHorizontal className="size-3.5" />
          {resultCount} result{resultCount === 1 ? "" : "s"}
        </span>
        {activeTags.length === 0 ? (
          <span className="text-xs font-semibold text-slate-400 dark:text-white/32">
            No filters applied
          </span>
        ) : (
          <>
            {activeTags.map((tag) => (
              <button
                key={tag.key}
                type="button"
                onClick={() => {
                  if (tag.key === "q") setSearch("");
                  setFilter(tag.key, "");
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-700/10 bg-emerald-100/60 px-2.5 py-1.5 text-[0.65rem] font-extrabold text-emerald-800 hover:border-emerald-700/20 hover:bg-emerald-100 dark:border-lime-300/10 dark:bg-lime-300/8 dark:text-lime-300 dark:hover:bg-lime-300/12"
              >
                {tag.label}
                <X className="size-3" />
              </button>
            ))}
            <button
              type="button"
              onClick={clearAll}
              className="ml-1 text-[0.65rem] font-extrabold text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-900 dark:text-white/38 dark:decoration-white/20 dark:hover:text-white"
            >
              Clear all
            </button>
          </>
        )}
      </div>
    </section>
  );
}
