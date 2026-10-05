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

// Sets a worker's hourly pay rate and/or W-2/1099 classification, used by
// the Financials and Payroll pages to turn logged hours into gross pay.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);

  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const update: Record<string, unknown> = {};

  if ("pay_rate" in body) {
    const { pay_rate } = body;
    if (pay_rate !== null && (typeof pay_rate !== "number" || !Number.isFinite(pay_rate) || pay_rate < 0)) {
      return NextResponse.json({ error: "pay_rate must be a non-negative number or null." }, { status: 400 });
    }
    update.pay_rate = pay_rate;
  }

  if ("worker_type" in body) {
    const { worker_type } = body;
    if (worker_type !== "w2" && worker_type !== "1099") {
      return NextResponse.json({ error: "worker_type must be 'w2' or '1099'." }, { status: 400 });
    }
    update.worker_type = worker_type;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data: target } = await supabase
    .from("profiles")
    .select("id, company_id")
    .eq("id", id)
    .single();

  if (!target || target.company_id !== profile.company_id) {
    return NextResponse.json({ error: "Worker not found." }, { status: 404 });
  }

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", id)
    .eq("company_id", profile.company_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
