import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { verifyToken } from "@/lib/auth";
import type { LogEntryType, LogEntryField, LogEntryFieldOption } from "@/types/logConfig";

// GET /api/log-config — public, returns all active types with their fields and options
export async function GET() {
  const sb = getSupabase();

  const { data: types, error: typesErr } = await sb
    .from("log_entry_types")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (typesErr) return NextResponse.json({ error: typesErr.message }, { status: 500 });
  if (!types?.length) return NextResponse.json([]);

  const typeIds = types.map((t) => t.id);

  const { data: fields, error: fieldsErr } = await sb
    .from("log_entry_fields")
    .select("*")
    .in("type_id", typeIds)
    .order("sort_order");
  if (fieldsErr) return NextResponse.json({ error: fieldsErr.message }, { status: 500 });

  const fieldIds = (fields ?? []).map((f) => f.id);

  let options: LogEntryFieldOption[] = [];
  if (fieldIds.length) {
    const { data, error: optErr } = await sb
      .from("log_entry_field_options")
      .select("*")
      .in("field_id", fieldIds)
      .order("sort_order");
    if (optErr) return NextResponse.json({ error: optErr.message }, { status: 500 });
    options = data ?? [];
  }

  const result: LogEntryType[] = types.map((t) => ({
    ...t,
    fields: (fields ?? [])
      .filter((f) => f.type_id === t.id)
      .map((f): LogEntryField => ({
        ...f,
        options: options.filter((o) => o.field_id === f.id),
      })),
  }));

  return NextResponse.json(result);
}

function authCheck(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  return token && verifyToken(token);
}

// POST /api/log-config — create a new log entry type
export async function POST(request: Request) {
  if (!authCheck(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { data, error } = await getSupabase()
    .from("log_entry_types")
    .insert({ name: body.name, slug: body.slug, sort_order: body.sort_order ?? 0 })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PUT /api/log-config — update a log entry type
export async function PUT(request: Request) {
  if (!authCheck(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...updates } = await request.json();
  const { data, error } = await getSupabase()
    .from("log_entry_types")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/log-config — delete a log entry type (cascades to fields and options)
export async function DELETE(request: Request) {
  if (!authCheck(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();
  const { error } = await getSupabase().from("log_entry_types").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
