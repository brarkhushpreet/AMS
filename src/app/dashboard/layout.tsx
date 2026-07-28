import { requireProfile } from "@/lib/current-profile";
import { AppShell } from "@/components/dashboard/app-shell";

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
      {children}
    </AppShell>
  );
}
