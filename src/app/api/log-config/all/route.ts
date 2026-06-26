import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { verifyToken } from "@/lib/auth";
import type { LogEntryType, LogEntryField, LogEntryFieldOption } from "@/types/logConfig";

// GET /api/log-config/all — admin only, returns ALL types including hidden ones
export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getSupabase();

  const { data: types, error: typesErr } = await sb
    .from("log_entry_types")
    .select("*")
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
    time_mode: t.time_mode ?? (t.is_timed ? "job" : "none"),
    fields: (fields ?? [])
      .filter((f) => f.type_id === t.id)
      .map((f): LogEntryField => ({
        ...f,
        options: options.filter((o) => o.field_id === f.id),
      })),
  }));

  return NextResponse.json(result);
}
