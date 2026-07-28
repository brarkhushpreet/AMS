import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { AuthCompanion } from "@/components/auth/auth-companion";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="h-dvh overflow-hidden bg-[#f2f1eb] transition-colors dark:bg-[#0d1110] lg:grid lg:grid-cols-[0.88fr_1.12fr]">
      <section className="paper-noise relative hidden h-dvh overflow-hidden bg-[#141a17] p-9 text-white lg:flex lg:flex-col xl:p-12">
        <div className="absolute left-[10%] top-[10%] size-60 rounded-full bg-cyan-300/8 blur-[100px]" />
        <div className="absolute bottom-[7%] right-[8%] size-72 rounded-full bg-violet-400/10 blur-[110px]" />
        <BrandLogo className="relative z-10 text-white" />
        <div className="relative z-10 my-auto">
          <AuthCompanion />
        </div>
      </section>
      <section className="flex h-dvh min-h-0 flex-col overflow-hidden px-5 py-4 sm:px-10 lg:px-14 xl:px-20">
        <div className="flex items-center justify-between">
          <div className="lg:hidden">
            <BrandLogo />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold text-slate-500 hover:bg-black/5 hover:text-slate-950 dark:text-white/50 dark:hover:bg-white/7 dark:hover:text-white"
            >
              <ArrowLeft className="size-3.5" />
              Back home
            </Link>
          </div>
        </div>
        <div className="my-auto min-h-0 w-full py-3 sm:py-5">{children}</div>
      </section>
    </main>
  );
}
