import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile.is_dev) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("company_id", profile.company_id);

  return NextResponse.json({
    currentUserId: user.id,
    profiles: (profiles ?? []).sort((a, b) => a.full_name.localeCompare(b.full_name)),
  });
}
