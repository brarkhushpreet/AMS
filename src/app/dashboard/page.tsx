import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/current-profile";

export default async function DashboardPage() {
  const profile = await requireProfile();
  redirect(
    profile.role === "TEACHER" ? "/dashboard/teacher" : "/dashboard/student",
  );
}
