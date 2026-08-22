import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("job_checklist_items")
    .select("*")
    .eq("company_id", profile.company_id)
    .eq("job_id", jobId)
    .order("position")
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { job_id, text, position } = await request.json();
  if (!job_id || !text) return NextResponse.json({ error: "job_id and text are required" }, { status: 400 });

  const { data, error } = await supabase
    .from("job_checklist_items")
    .insert({ job_id, text, position: position ?? 0, company_id: profile.company_id })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Non-admins may only ever toggle completion — editing text/position is
// admin-only. The RLS policy on job_checklist_items allows any company
// member to UPDATE the row, so this whitelist is the real enforcement.
export async function PUT(request: Request) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, is_done, text, position } = await request.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (profile.role === "admin") {
    if (text !== undefined) updates.text = text;
    if (position !== undefined) updates.position = position;
  }
  if (is_done !== undefined) {
    updates.is_done = is_done;
    updates.done_by = is_done ? profile.full_name : null;
    updates.done_at = is_done ? new Date().toISOString() : null;
  }

  const { data, error } = await supabase
    .from("job_checklist_items")
    .update(updates)
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await request.json();
  const { error } = await supabase
    .from("job_checklist_items")
    .delete()
    .eq("id", id)
    .eq("company_id", profile.company_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
