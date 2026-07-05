import { redirect } from "next/navigation";
import TimesheetForm from "@/components/TimesheetForm";
import BottomNav from "@/components/BottomNav";
import DesktopHeader from "@/components/DesktopHeader";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";

export default async function Home() {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);

  if (!user || !profile) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <DesktopHeader name={profile.full_name} />
      <main className="max-w-2xl mx-auto px-4 pt-6" style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}>
        <TimesheetForm userName={profile.full_name} userId={user.id} />
      </main>
      <BottomNav />
    </div>
  );
}
