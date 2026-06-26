import Image from "next/image";
import { redirect } from "next/navigation";
import TimesheetForm from "@/components/TimesheetForm";
import TodaySchedule from "@/components/TodaySchedule";
import BottomNav from "@/components/BottomNav";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";

export default async function Home() {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);

  if (!user || !profile) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Image src="/logo.webp" alt="Cumberland Earthworks" width={140} height={39} priority />
          <span className="text-sm text-gray-500 font-medium">{profile.full_name}</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-6">
        <TodaySchedule />
        <div className="border-t border-gray-200 pt-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Log Today&apos;s Hours</p>
          <TimesheetForm userName={profile.full_name} userId={user.id} />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
