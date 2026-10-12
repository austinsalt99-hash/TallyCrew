import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import { cleanClientFields } from "./clientFields";

async function adminGuard(supabase: Awaited<ReturnType<typeof createSupabaseServer>>) {
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return { error: "Unauthorized", status: 401, profile: null };
  if (profile.role !== "admin") return { error: "Forbidden", status: 403, profile: null };
  return { error: null, status: 200, profile };
}

export async function GET() {
  const supabase = await createSupabaseServer();
  const { error: authErr, status, profile } = await adminGuard(supabase);
  if (authErr || !profile) return NextResponse.json({ error: authErr }, { status });

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("company_id", profile.company_id)
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { error: authErr, status, profile } = await adminGuard(supabase);
  if (authErr || !profile) return NextResponse.json({ error: authErr }, { status });

  const fields = cleanClientFields(await request.json());
  if (!fields.name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  // Same name already saved (any capitalisation) — hand back that contact
  // rather than failing, so "Save as new contact" just links to it.
  const { data: existing } = await supabase
    .from("clients")
    .select("*")
    .eq("company_id", profile.company_id)
    .ilike("name", fields.name.replace(/[\\%_]/g, (c) => `\\${c}`))
    .maybeSingle();
  if (existing) return NextResponse.json(existing);

  const { data, error } = await supabase
    .from("clients")
    .insert({ ...fields, company_id: profile.company_id })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
