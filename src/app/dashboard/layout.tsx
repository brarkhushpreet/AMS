import { requireProfile } from "@/lib/current-profile";
import { AppShell } from "@/components/dashboard/app-shell";
import { isDemoUser } from "@/lib/demo-policy";
import { logoutAction } from "@/lib/auth-actions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  return (
    <AppShell
      name={profile.name}
      email={profile.email}
      role={profile.role}
    >
      {isDemoUser(profile.id) && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--accent-soft)] px-4 py-3 text-xs text-[var(--foreground)]">
          <p><strong>Demo workspace</strong> · Fictional data. Explore the dashboards and filters; changes are disabled.</p>
          <form action={logoutAction}>
            <button type="submit" className="rounded-md px-2 py-1 font-semibold text-[var(--accent)] hover:underline">Exit demo</button>
          </form>
        </div>
      )}
      {children}
    </AppShell>
  );
}
