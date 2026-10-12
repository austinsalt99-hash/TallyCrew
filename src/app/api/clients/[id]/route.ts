import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import { paidTotals } from "@/lib/billing";
import { cleanClientFields } from "../clientFields";

async function adminGuard(supabase: Awaited<ReturnType<typeof createSupabaseServer>>) {
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return { error: "Unauthorized", status: 401, profile: null };
  if (profile.role !== "admin") return { error: "Forbidden", status: 403, profile: null };
  return { error: null, status: 200, profile };
}

// One contact plus everything linked to it: quotes, jobs and invoices.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { error: authErr, status, profile } = await adminGuard(supabase);
  if (authErr || !profile) return NextResponse.json({ error: authErr }, { status });

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .maybeSingle();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const [quotes, invoices, jobs, paid] = await Promise.all([
    supabase.from("quotes")
      .select("id, quote_number, title, status, valid_until, total, target_date, converted_job_id, converted_invoice_id")
      .eq("company_id", profile.company_id).eq("client_id", id).order("created_at", { ascending: false }),
    supabase.from("invoices")
      .select("id, invoice_number, invoice_date, status, total")
      .eq("company_id", profile.company_id).eq("client_id", id).order("invoice_date", { ascending: false }),
    supabase.from("job_events")
      .select("id, title, date, status")
      .eq("company_id", profile.company_id).eq("client_id", id).order("date", { ascending: false }).limit(50),
    paidTotals(supabase, profile.company_id),
  ]);

  return NextResponse.json({
    client,
    quotes: (quotes.data ?? []).map((q) => ({ ...q, amount_paid: paid.byQuote.get(q.id) ?? 0 })),
    invoices: (invoices.data ?? []).map((inv) => ({ ...inv, amount_paid: paid.byInvoice.get(inv.id) ?? 0 })),
    jobs: jobs.data ?? [],
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { error: authErr, status, profile } = await adminGuard(supabase);
  if (authErr || !profile) return NextResponse.json({ error: authErr }, { status });

  const fields = cleanClientFields(await request.json());
  if ("name" in fields && !fields.name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const { data, error } = await supabase
    .from("clients")
    .update(fields)
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .select()
    .single();
  if (error) {
    const msg = error.code === "23505" ? "You already have a contact with that name." : error.message;
    return NextResponse.json({ error: msg }, { status: error.code === "23505" ? 409 : 500 });
  }
  return NextResponse.json(data);
}

// Removes the contact only — jobs, quotes and invoices keep the client name
// typed on them; their client_id is cleared by the foreign key.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { error: authErr, status, profile } = await adminGuard(supabase);
  if (authErr || !profile) return NextResponse.json({ error: authErr }, { status });

  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id)
    .eq("company_id", profile.company_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
