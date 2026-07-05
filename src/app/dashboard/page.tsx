import { redirect } from "next/navigation";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import BottomNav from "@/components/BottomNav";
import DashboardView from "@/components/DashboardView";

export default async function DashboardPage() {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) redirect("/login");

  return (
    <div className="min-h-screen">
      <DashboardView userName={profile.full_name} />
      <BottomNav />
    </div>
  );
}
