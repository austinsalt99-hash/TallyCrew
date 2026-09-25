import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

// Soft-removes a worker: bans them at the Supabase Auth layer (blocks
// sign-in, and — since this app always calls supabase.auth.getUser(), never
// getSession() — invalidates any session they're currently holding on their
// very next request) and flags the profile as removed so they're excluded
// from seat counts and active-worker views. The profile row itself, and all
// of their historical submissions, are kept untouched for the company's
// records (submissions.employee_name is captured independently at submit
// time, so it isn't affected by anything here).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);

  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (id === profile.id) {
    return NextResponse.json({ error: "You can't remove yourself." }, { status: 400 });
  }

  const { data: target } = await supabase
    .from("profiles")
    .select("id, company_id, role, is_removed")
    .eq("id", id)
    .single();

  if (!target || target.company_id !== profile.company_id) {
    return NextResponse.json({ error: "Worker not found." }, { status: 404 });
  }
  if (target.role !== "worker") {
    return NextResponse.json({ error: "Only workers can be removed." }, { status: 400 });
  }
  if (target.is_removed) {
    return NextResponse.json({ ok: true });
  }

  const admin = createSupabaseAdmin();
  const { error: banError } = await admin.auth.admin.updateUserById(id, {
    ban_duration: "876000h", // ~100 years — Supabase's documented pattern for a permanent ban
  });
  if (banError) {
    console.error("Worker ban failed:", banError);
    return NextResponse.json({ error: "Could not remove worker. Please try again." }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ is_removed: true, removed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", profile.company_id);

  if (updateError) {
    console.error("Profile removal flag update failed:", updateError);
    return NextResponse.json(
      { error: "Worker was signed out but the roster update failed. Refresh and try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
