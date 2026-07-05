import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import type { LogEntryType, LogEntryField, LogEntryFieldOption } from "@/types/logConfig";

async function fetchTypesForCompany(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  companyId: string,
  activeOnly: boolean
) {
  let typeQuery = supabase
    .from("log_entry_types")
    .select("*")
    .eq("company_id", companyId)
    .order("sort_order");
  if (activeOnly) typeQuery = typeQuery.eq("is_active", true);

  const { data: types, error: typesErr } = await typeQuery;
  if (typesErr || !types?.length) return { types: types ?? [], error: typesErr };

  const typeIds = types.map((t) => t.id);
  const { data: fields, error: fieldsErr } = await supabase
    .from("log_entry_fields")
    .select("*")
    .in("type_id", typeIds)
    .order("sort_order");
  if (fieldsErr) return { types: [], error: fieldsErr };

  const fieldIds = (fields ?? []).map((f) => f.id);
  let options: LogEntryFieldOption[] = [];
  if (fieldIds.length) {
    const { data, error: optErr } = await supabase
      .from("log_entry_field_options")
      .select("*")
      .in("field_id", fieldIds)
      .order("sort_order");
    if (optErr) return { types: [], error: optErr };
    options = data ?? [];
  }

  const result: LogEntryType[] = types.map((t) => ({
    ...t,
    time_mode: t.time_mode ?? (t.is_timed ? "job" : "none"),
    fields: (fields ?? [])
      .filter((f) => f.type_id === t.id)
      .map((f): LogEntryField => ({ ...f, options: options.filter((o) => o.field_id === f.id) })),
  }));
  return { types: result, error: null };
}

export async function GET() {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { types, error } = await fetchTypesForCompany(supabase, profile.company_id, true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(types);
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const timeMode: string = body.time_mode ?? "job";
  const { data, error } = await supabase
    .from("log_entry_types")
    .insert({
      company_id: profile.company_id,
      name: body.name,
      slug: body.slug,
      sort_order: body.sort_order ?? 0,
      time_mode: timeMode,
      is_timed: timeMode === "job",
      is_priced: body.is_priced ?? false,
      rate_type: body.rate_type ?? null,
      rate_amount: body.rate_amount ?? null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { id } = body;
  const safeUpdates = {
    name:        body.name,
    slug:        body.slug,
    sort_order:  body.sort_order,
    is_active:   body.is_active,
    time_mode:   body.time_mode,
    is_timed:    body.is_timed,
    is_priced:   body.is_priced,
    rate_type:   body.rate_type,
    rate_amount: body.rate_amount,
  };
  const { error } = await supabase
    .from("log_entry_types")
    .update(safeUpdates)
    .eq("id", id)
    .eq("company_id", profile.company_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await request.json();
  const { error } = await supabase
    .from("log_entry_types")
    .delete()
    .eq("id", id)
    .eq("company_id", profile.company_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
