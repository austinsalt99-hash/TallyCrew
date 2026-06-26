import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { data, error } = await supabase
    .from("invoices")
    .insert({
      company_id: profile.company_id,
      invoice_number: body.invoice_number,
      client_name: body.client_name,
      date_from: body.date_from,
      date_to: body.date_to,
      invoice_date: body.invoice_date,
      company_name: body.company_name ?? null,
      company_address: body.company_address ?? null,
      line_items: body.line_items ?? [],
      total: body.total ?? 0,
      notes: body.notes ?? null,
      status: body.status ?? "draft",
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
