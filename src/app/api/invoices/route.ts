import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { verifyToken } from "@/lib/auth";

function authCheck(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  return token && verifyToken(token);
}

export async function GET() {
  const { data, error } = await getSupabase()
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  if (!authCheck(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { data, error } = await getSupabase()
    .from("invoices")
    .insert({
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
