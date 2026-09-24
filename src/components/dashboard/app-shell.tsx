"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarCheck2,
  LogOut,
  Menu,
  PanelLeftClose,
  Plus,
  SlidersHorizontal,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import type { Role } from "@/generated/prisma/client";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { logoutAction } from "@/lib/auth-actions";
import { cn, initials } from "@/lib/utils";

const navByRole = {
  TEACHER: [
    { label: "Overview", href: "/dashboard/teacher", icon: BarChart3 },
    { label: "Classrooms", href: "/dashboard/teacher/classes", icon: UsersRound },
    {
      label: "Attendance",
      href: "/dashboard/teacher/attendance",
      icon: CalendarCheck2,
    },
    { label: "Equipment check", href: "/dashboard/equipment", icon: SlidersHorizontal },
    {
      label: "Device security",
      href: "/dashboard/security",
      icon: ShieldCheck,
    },
  ],
  STUDENT: [
    { label: "Overview", href: "/dashboard/student", icon: BarChart3 },
    { label: "My classes", href: "/dashboard/student/classes", icon: BookOpen },
    {
      label: "Attendance",
      href: "/dashboard/student/attendance",
      icon: CalendarCheck2,
    },
    { label: "Equipment check", href: "/dashboard/equipment", icon: SlidersHorizontal },
    {
      label: "Device security",
      href: "/dashboard/security",
      icon: ShieldCheck,
    },
  ],
} satisfies Record<Role, Array<{ label: string; href: string; icon: typeof BarChart3 }>>;

function pageTitle(pathname: string, role: Role) {
  if (pathname.includes("/equipment")) return "Equipment check";
  if (pathname.includes("/receipt")) return "Session receipt";
  if (pathname.includes("/attendance")) return "Attendance";
  if (pathname.includes("/security")) return "Device security";
  if (pathname.includes("/classes/")) return "Classroom";
  if (pathname.endsWith("/classes")) return "Classrooms";
  if (pathname.endsWith("/join")) return "Join a classroom";
  return role === "TEACHER" ? "Teacher overview" : "Student overview";
}

export function AppShell({
  children,
  name,
  email,
  role,
}: {
  children: React.ReactNode;
  name: string;
  email: string;
  role: Role;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigation = navByRole[role];

  return (
    <div className="min-h-screen bg-[var(--background)] transition-colors dark:bg-[var(--background)]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-[var(--border)] bg-[var(--surface)] p-3 transition-transform lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-12 items-center justify-between px-2">
          <BrandLogo href="/dashboard" />
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="grid size-9 place-items-center rounded-xl text-slate-500 hover:bg-black/5 lg:hidden dark:text-white/50 dark:hover:bg-white/8"
            aria-label="Close navigation"
          >
            <PanelLeftClose className="size-4.5" />
          </button>
        </div>

        <nav aria-label="Workspace" className="mt-8 flex-1 space-y-1">
          <p className="mb-3 px-3 text-[0.6rem] font-semibold tracking-[0.18em] text-slate-500 uppercase dark:text-white/60">
            Workspace
          </p>
          {navigation.map((item) => {
            const active =
              pathname === item.href ||
              (item.href.endsWith("/classes") &&
                pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "group flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium",
                  active
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-slate-500 hover:bg-black/4 hover:text-slate-950 dark:text-white/60 dark:hover:bg-white/6 dark:hover:text-white",
                )}
              >
                <span
                  className={cn(
                    "grid size-7 place-items-center rounded-lg",
                    active
                      ? "text-[var(--accent)]"
                      : "text-slate-500 dark:text-white/60",
                  )}
                >
                  <item.icon className="size-4" />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {role === "TEACHER" ? (
          <Link
            href="/dashboard/teacher/classes?create=1"
            onClick={() => setMobileOpen(false)}
            className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-xs font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)]"
          >
            <Plus className="size-4" />
            New classroom
          </Link>
        ) : (
          <Link
            href="/dashboard/student/join"
            onClick={() => setMobileOpen(false)}
            className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-xs font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)]"
          >
            <Plus className="size-4" />
            Join classroom
          </Link>
        )}

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[0.65rem] font-semibold text-[var(--accent)]">
              {initials(name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{name}</p>
              <p className="truncate text-[0.6rem] font-semibold text-slate-500 dark:text-white/60">
                {email}
              </p>
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[0.68rem] font-medium text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
            >
              <LogOut className="size-3.5" />
              Log out
            </button>
          </form>
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)] px-4 sm:px-7">
          <div className="flex h-16 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="grid size-9 place-items-center rounded-xl border border-black/8 bg-white/70 text-slate-600 shadow-sm lg:hidden dark:border-white/10 dark:bg-white/5 dark:text-white/60"
              aria-label="Open navigation"
            >
              <Menu className="size-4" />
            </button>
            <div className="flex items-center gap-3">
              <span className="hidden h-7 w-px bg-black/8 sm:block dark:bg-white/8" />
              <div>
                <h1 className="text-xs font-semibold tracking-tight text-slate-950 dark:text-white">
                  {pageTitle(pathname, role)}
                </h1>
                <p className="hidden text-[0.58rem] font-semibold tracking-wide text-slate-500 sm:block dark:text-white/60">
                  ClassPulse / {role === "TEACHER" ? "Teacher" : "Student"}
                </p>
              </div>
            </div>
            <span className="ml-auto" />
            <ThemeToggle className="size-9" />
            <span className="hidden rounded-full bg-black/[0.045] px-3 py-1.5 text-[0.58rem] font-semibold tracking-[0.12em] text-slate-600 uppercase md:inline-flex dark:bg-white/6 dark:text-white/60">
              {role.toLowerCase()}
            </span>
          </div>
        </header>
        <main id="main-content" className="mx-auto max-w-[100rem] p-4 sm:p-7 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
