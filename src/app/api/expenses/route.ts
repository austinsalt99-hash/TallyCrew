import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import { ownsRow } from "@/lib/billing";
import { deleteTimesheetExpense, timesheetExpensesForJobIds } from "@/lib/expenseSummary";
import { EXPENSE_CATEGORIES, type ExpenseItem } from "@/types/expense";

async function adminGuard(supabase: Awaited<ReturnType<typeof createSupabaseServer>>) {
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return { error: "Unauthorized", status: 401, profile: null };
  if (profile.role !== "admin") return { error: "Forbidden", status: 403, profile: null };
  return { error: null, status: 200, profile };
}

const CATEGORIES: string[] = EXPENSE_CATEGORIES.map((c) => c.value);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface ExpenseRow {
  id: string;
  job_id: string | null;
  quote_id: string | null;
  invoice_id: string | null;
  amount: number;
  category: string;
  note: string | null;
  incurred_on: string;
}

function rowToItem(r: ExpenseRow, jobTitleById?: Map<string, string>): ExpenseItem {
  return {
    id: r.id,
    source: "manual",
    amount: Number(r.amount),
    category: (r.category as ExpenseItem["category"]) ?? "other",
    note: r.note,
    date: r.incurred_on,
    jobId: r.job_id,
    jobTitle: r.job_id ? jobTitleById?.get(r.job_id) ?? null : null,
    removable: true,
  };
}

// GET /api/expenses?jobId=… | ?jobIds=a,b,c | ?quoteId=… | ?invoiceId=…
// An invoice passes both invoiceId and the jobIds of its linked jobs, since
// an expense entered on a linked job's calendar panel counts toward the
// invoice too. Combines `expenses` table rows with employee-logged ones
// embedded on timesheets (see src/lib/expenseSummary.ts) into one list.
export async function GET(request: Request) {
  const supabase = await createSupabaseServer();
  const { error: authErr, status, profile } = await adminGuard(supabase);
  if (authErr || !profile) return NextResponse.json({ error: authErr }, { status });

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  const jobIds = [
    ...new Set([
      ...(searchParams.get("jobIds")?.split(",").filter(Boolean) ?? []),
      ...(jobId ? [jobId] : []),
    ]),
  ];
  const quoteId = searchParams.get("quoteId");
  const invoiceId = searchParams.get("invoiceId");
  if (jobIds.length === 0 && !quoteId && !invoiceId) {
    return NextResponse.json({ error: "jobId, quoteId or invoiceId required" }, { status: 400 });
  }

  let query = supabase.from("expenses").select("*").eq("company_id", profile.company_id);
  if (jobIds.length && quoteId) query = query.or(`job_id.in.(${jobIds.join(",")}),quote_id.eq.${quoteId}`);
  else if (jobIds.length && invoiceId) query = query.or(`job_id.in.(${jobIds.join(",")}),invoice_id.eq.${invoiceId}`);
  else if (jobIds.length) query = query.in("job_id", jobIds);
  else if (quoteId) query = query.eq("quote_id", quoteId);
  else if (invoiceId) query = query.eq("invoice_id", invoiceId);

  const { data, error } = await query.order("incurred_on", { ascending: false }).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // So a breakdown across several linked jobs can label each row — a job_id
  // alone isn't enough to show "which job" in the UI.
  const rowJobIds = [...new Set((data ?? []).map((r) => r.job_id).filter(Boolean))] as string[];
  const { data: jobRows } = rowJobIds.length
    ? await supabase.from("job_events").select("id, title").eq("company_id", profile.company_id).in("id", rowJobIds)
    : { data: [] as { id: string; title: string }[] };
  const jobTitleById = new Map((jobRows ?? []).map((j) => [j.id, j.title]));

  const manual = (data ?? []).map((r) => rowToItem(r, jobTitleById));
  const timesheet = jobIds.length ? await timesheetExpensesForJobIds(supabase, profile.company_id, jobIds) : [];
  const items = [...manual, ...timesheet].sort((a, b) => b.date.localeCompare(a.date));

  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { error: authErr, status, profile } = await adminGuard(supabase);
  if (authErr || !profile) return NextResponse.json({ error: authErr }, { status });

  const body = await request.json();
  const amount = Math.round((parseFloat(String(body.amount ?? "")) || 0) * 100) / 100;
  if (amount <= 0) return NextResponse.json({ error: "Enter an amount greater than $0." }, { status: 400 });
  const category = CATEGORIES.includes(body.category) ? body.category : "other";
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
  const incurredOn = typeof body.incurred_on === "string" && DATE_RE.test(body.incurred_on) ? body.incurred_on : null;
  if (!incurredOn) return NextResponse.json({ error: "Enter the date it was incurred." }, { status: 400 });

  let jobId: string | null = null;
  let quoteId: string | null = null;
  let invoiceId: string | null = null;
  if (body.job_id) {
    if (!(await ownsRow(supabase, "job_events", body.job_id, profile.company_id))) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    jobId = body.job_id;
  }
  if (body.quote_id) {
    if (!(await ownsRow(supabase, "quotes", body.quote_id, profile.company_id))) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }
    quoteId = body.quote_id;
  }
  if (body.invoice_id) {
    if (!(await ownsRow(supabase, "invoices", body.invoice_id, profile.company_id))) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    invoiceId = body.invoice_id;
  }

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      company_id: profile.company_id,
      job_id: jobId,
      quote_id: quoteId,
      invoice_id: invoiceId,
      amount,
      category,
      note,
      incurred_on: incurredOn,
      created_by: profile.id,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(rowToItem(data));
}

// Deletes a manual `expenses` row by id, or (source: "timesheet") an
// employee-logged line embedded on a submission — pass that submission's id
// alongside, since there's no table row to address it by.
export async function DELETE(request: Request) {
  const supabase = await createSupabaseServer();
  const { error: authErr, status, profile } = await adminGuard(supabase);
  if (authErr || !profile) return NextResponse.json({ error: authErr }, { status });

  const { id, source, submissionId } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  if (source === "timesheet") {
    if (!submissionId) return NextResponse.json({ error: "submissionId required" }, { status: 400 });
    const ok = await deleteTimesheetExpense(supabase, profile.company_id, submissionId, id);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase.from("expenses").delete().eq("id", id).eq("company_id", profile.company_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
