import { redirect } from "next/navigation";
import TimesheetForm from "@/components/TimesheetForm";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";

export default async function AdminTimesheetPage() {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);

  if (!user || !profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  return (
    <div className="max-w-2xl mx-auto">
      <TimesheetForm userName={profile.full_name} userId={user.id} />
    </div>
  );
}
