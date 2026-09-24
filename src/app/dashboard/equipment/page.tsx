import type { Metadata } from "next";
import { EquipmentCheck } from "@/components/attendance/equipment-check";
import { requireProfile } from "@/lib/current-profile";

export const metadata: Metadata = { title: "Equipment check" };

export default async function EquipmentPage() {
  const profile = await requireProfile();
  return <div className="space-y-7"><header className="border-b border-[var(--border)] pb-6"><p className="text-sm text-[var(--muted)]">Before the session</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Check your room’s audio.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Play a test sequence on the classroom speaker and listen from a student device. This checks signal reception in your setup; it does not mark attendance.</p></header><EquipmentCheck role={profile.role} /></div>;
}
