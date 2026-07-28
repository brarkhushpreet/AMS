"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarCheck2,
  ChevronDown,
  LogOut,
  Menu,
  PanelLeftClose,
  Plus,
  RadioTower,
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
  ],
  STUDENT: [
    { label: "Overview", href: "/dashboard/student", icon: BarChart3 },
    { label: "My classes", href: "/dashboard/student/classes", icon: BookOpen },
    {
      label: "Attendance",
      href: "/dashboard/student/attendance",
      icon: CalendarCheck2,
    },
  ],
} satisfies Record<Role, Array<{ label: string; href: string; icon: typeof BarChart3 }>>;

function pageTitle(pathname: string, role: Role) {
  if (pathname.includes("/attendance")) return "Attendance";
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
    <div className="min-h-screen bg-[#f2f1eb] transition-colors dark:bg-[#0d1110]">
      <aside
        className={cn(
          "paper-noise fixed inset-y-0 left-0 z-50 flex w-[15rem] flex-col border-r border-black/8 bg-[#f9f8f2] p-3.5 transition-transform lg:inset-y-3 lg:left-3 lg:rounded-[1.7rem] lg:border lg:translate-x-0 dark:border-white/8 dark:bg-[#121815]",
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

        <nav className="mt-8 flex-1 space-y-1">
          <p className="mb-3 px-3 text-[0.6rem] font-black tracking-[0.18em] text-slate-400 uppercase dark:text-white/28">
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
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "group flex h-10 items-center gap-2.5 rounded-xl px-2.5 text-[0.76rem] font-bold",
                  active
                    ? "bg-[#dff7ee] text-emerald-800 dark:bg-lime-300/10 dark:text-lime-300"
                    : "text-slate-500 hover:bg-black/4 hover:text-slate-950 dark:text-white/42 dark:hover:bg-white/6 dark:hover:text-white",
                )}
              >
                <span
                  className={cn(
                    "grid size-7 place-items-center rounded-lg",
                    active
                      ? "bg-white text-emerald-700 shadow-sm dark:bg-white/8 dark:text-lime-300"
                      : "text-slate-400 dark:text-white/30",
                  )}
                >
                  <item.icon className="size-4" />
                </span>
                {item.label}
                {active && <span className="ml-auto size-1.5 rounded-full bg-emerald-600 dark:bg-lime-300" />}
              </Link>
            );
          })}
        </nav>

        {role === "TEACHER" ? (
          <Link
            href="/dashboard/teacher/classes?create=1"
            onClick={() => setMobileOpen(false)}
            className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-[#151a17] px-4 py-3 text-xs font-extrabold text-white shadow-lg shadow-black/10 hover:-translate-y-0.5 hover:bg-black dark:bg-[#b5f44b] dark:text-[#172008]"
          >
            <Plus className="size-4" />
            New classroom
          </Link>
        ) : (
          <Link
            href="/dashboard/student/join"
            onClick={() => setMobileOpen(false)}
            className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-[#151a17] px-4 py-3 text-xs font-extrabold text-white shadow-lg shadow-black/10 hover:-translate-y-0.5 hover:bg-black dark:bg-[#b5f44b] dark:text-[#172008]"
          >
            <Plus className="size-4" />
            Join classroom
          </Link>
        )}

        <div className="rounded-2xl border border-black/8 bg-black/[0.025] p-3 dark:border-white/8 dark:bg-white/[0.035]">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#151a17] text-[0.65rem] font-black text-white dark:bg-[#b5f44b] dark:text-[#172008]">
              {initials(name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-extrabold text-slate-900 dark:text-white">{name}</p>
              <p className="truncate text-[0.6rem] font-semibold text-slate-400 dark:text-white/32">
                {email}
              </p>
            </div>
            <ChevronDown className="size-3.5 text-slate-400 dark:text-white/30" />
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-black/8 bg-white/60 px-3 py-2 text-[0.68rem] font-extrabold text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-white/8 dark:bg-white/5 dark:text-white/42 dark:hover:bg-red-300/8 dark:hover:text-red-300"
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

      <div className="lg:pl-[16rem]">
        <header className="sticky top-0 z-30 p-3 pb-0 sm:px-5 lg:px-6">
          <div className="flex h-14 items-center gap-3 rounded-2xl border border-black/8 bg-[#f9f8f2]/88 px-3 shadow-[0_14px_40px_-32px_rgba(10,22,16,.45)] backdrop-blur-xl sm:px-4 dark:border-white/8 dark:bg-[#151b18]/88">
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
                <h1 className="text-xs font-black tracking-tight text-slate-950 dark:text-white">
                  {pageTitle(pathname, role)}
                </h1>
                <p className="hidden text-[0.58rem] font-semibold tracking-wide text-slate-400 sm:block dark:text-white/28">
                  ClassPulse / {role === "TEACHER" ? "Teacher" : "Student"}
                </p>
              </div>
            </div>
            <div className="ml-auto hidden items-center gap-2 rounded-full border border-emerald-700/8 bg-emerald-100/45 px-3 py-1.5 text-[0.6rem] font-extrabold text-emerald-800 sm:inline-flex dark:border-lime-300/8 dark:bg-lime-300/7 dark:text-lime-300">
              <RadioTower className="size-3" />
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-600 dark:bg-lime-300" />
              Presence system ready
            </div>
            <ThemeToggle className="size-9" />
            <span className="hidden rounded-full bg-black/[0.045] px-3 py-1.5 text-[0.58rem] font-black tracking-[0.12em] text-slate-600 uppercase md:inline-flex dark:bg-white/6 dark:text-white/45">
              {role.toLowerCase()}
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-[90rem] p-4 sm:p-5 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
