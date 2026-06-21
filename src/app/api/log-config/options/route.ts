import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { verifyToken } from "@/lib/auth";

function authCheck(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  return token && verifyToken(token);
}

export async function POST(request: Request) {
  if (!authCheck(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { data, error } = await getSupabase()
    .from("log_entry_field_options")
    .insert({ field_id: body.field_id, label: body.label, sort_order: body.sort_order ?? 0 })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  if (!authCheck(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...updates } = await request.json();
  const { data, error } = await getSupabase()
    .from("log_entry_field_options")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  if (!authCheck(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();
  const { error } = await getSupabase().from("log_entry_field_options").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
