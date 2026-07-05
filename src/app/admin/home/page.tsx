import { redirect } from "next/navigation";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import AdminDashboardView from "@/components/AdminDashboardView";

export default async function AdminHomePage() {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  return <AdminDashboardView userName={profile.full_name} />;
}
