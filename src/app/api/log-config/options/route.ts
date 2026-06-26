import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";

async function adminCheck() {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return { supabase, profile: null, err: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (profile.role !== "admin") return { supabase, profile: null, err: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { supabase, profile, err: null };
}

export async function POST(request: Request) {
  const { supabase, profile, err } = await adminCheck();
  if (err || !profile) return err!;

  const body = await request.json();
  const { data, error } = await supabase
    .from("log_entry_field_options")
    .insert({ field_id: body.field_id, label: body.label, sort_order: body.sort_order ?? 0 })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const { supabase, profile, err } = await adminCheck();
  if (err || !profile) return err!;

  const { id, ...updates } = await request.json();
  const { data, error } = await supabase
    .from("log_entry_field_options")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const { supabase, profile, err } = await adminCheck();
  if (err || !profile) return err!;

  const { id } = await request.json();
  const { error } = await supabase.from("log_entry_field_options").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
