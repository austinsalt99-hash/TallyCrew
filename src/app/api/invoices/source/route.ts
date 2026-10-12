import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";

// GET /api/invoices/source?quoteId=… or ?eventId=…
// Everything needed before invoicing a quote or a job: the quote behind it,
// every calendar day of the work (all days of an ongoing job, not just one),
// and any invoices that already cover it — so the editor can offer
// "bill as quoted / actual work" and warn before billing twice.
export async function GET(request: Request) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const companyId = profile.company_id;

  const { searchParams } = new URL(request.url);
  const quoteId = searchParams.get("quoteId");
  let eventId = searchParams.get("eventId");

  const QUOTE_COLS = "id, quote_number, title, total, converted_job_id, converted_invoice_id";
  type QuoteRow = { id: string; quote_number: string | null; title: string; total: number; converted_job_id: string | null; converted_invoice_id: string | null };
  let quote: QuoteRow | null = null;

  if (quoteId) {
    const { data } = await supabase.from("quotes").select(QUOTE_COLS).eq("id", quoteId).eq("company_id", companyId).maybeSingle();
    if (!data) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    quote = data;
    eventId = data.converted_job_id;
  }

  // The job, and every day scheduled under the same ongoing job
  let jobIds: string[] = [];
  let ongoingJobId: string | null = null;
  if (eventId) {
    const { data: event } = await supabase
      .from("job_events")
      .select("id, ongoing_job_id")
      .eq("id", eventId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (event) {
      ongoingJobId = event.ongoing_job_id ?? null;
      if (ongoingJobId) {
        const { data: siblings } = await supabase
          .from("job_events")
          .select("id")
          .eq("company_id", companyId)
          .eq("ongoing_job_id", ongoingJobId);
        jobIds = (siblings ?? []).map((s) => s.id);
      } else {
        jobIds = [event.id];
      }
    }
  }

  // Started from a job: find the quote it was scheduled from, if any
  if (!quote && jobIds.length > 0) {
    const { data } = await supabase
      .from("quotes")
      .select(QUOTE_COLS)
      .eq("company_id", companyId)
      .in("converted_job_id", jobIds)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    quote = data ?? null;
  }

  // Invoices already covering this work: made from the quote, or billing hours
  // logged against any of its days. Companies have few enough invoices that
  // checking line items here is simpler than one JSONB query per day.
  const { data: invoiceRows } = await supabase
    .from("invoices")
    .select("id, invoice_number, source_quote_id, line_items")
    .eq("company_id", companyId);
  const jobIdSet = new Set(jobIds);
  const invoices = (invoiceRows ?? [])
    .filter((inv) =>
      (quote && (inv.source_quote_id === quote.id || inv.id === quote.converted_invoice_id)) ||
      (Array.isArray(inv.line_items) &&
        inv.line_items.some((li: { sourceJobId?: string }) => li.sourceJobId && jobIdSet.has(li.sourceJobId))))
    .map((inv) => ({ id: inv.id as string, invoice_number: inv.invoice_number as string }));

  return NextResponse.json({
    quote: quote ? { id: quote.id, quote_number: quote.quote_number, title: quote.title, total: Number(quote.total) || 0 } : null,
    eventId,
    ongoingJobId,
    jobIds,
    invoices,
  });
}
