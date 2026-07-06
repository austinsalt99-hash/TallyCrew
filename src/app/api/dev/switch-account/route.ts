import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile.is_dev) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  // Verify target is in the same company
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .single();

  if (!targetProfile || targetProfile.company_id !== profile.company_id) {
    return NextResponse.json({ error: "User not found in this company" }, { status: 403 });
  }

  const admin = createSupabaseAdmin();
  const { data: targetUser } = await admin.auth.admin.getUserById(userId);
  if (!targetUser.user?.email) {
    return NextResponse.json({ error: "Could not retrieve user email" }, { status: 500 });
  }

  // Use the request origin so the redirect works regardless of which port the dev server is on
  const origin = req.headers.get("origin") || "http://localhost:3000";

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: targetUser.user.email,
    options: { redirectTo: `${origin}/auth/switch` },
  });

  if (error || !data?.properties?.action_link) {
    return NextResponse.json({ error: error?.message ?? "Failed to generate link" }, { status: 500 });
  }

  return NextResponse.json({ actionLink: data.properties.action_link });
}
