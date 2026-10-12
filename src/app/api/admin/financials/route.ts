import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import { aggregateEmployeeHours } from "@/lib/payrollSummary";
import { aggregateTimesheetExpenses } from "@/lib/expenseSummary";
import { categoryLabel } from "@/types/expense";

// Annual, per-worker hours + gross pay + W-2/1099 classification — the
// record a boss hands to an accountant or payroll provider at tax time.
// TallyCrew never computes withholding or files anything; this just makes
// sure the underlying numbers (hours, rate, classification) are correct
// and in one place. No SSN/EIN is stored here (see migration 25).
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const startParam = req.nextUrl.searchParams.get("start");
  const endParam = req.nextUrl.searchParams.get("end");

  let start: string;
  let end: string;
  if (startParam && endParam) {
    start = startParam;
    end = endParam;
  } else {
    const yearParam = req.nextUrl.searchParams.get("year");
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
    if (!Number.isFinite(year)) return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    start = `${year}-01-01`;
    end = `${year}-12-31`;
  }

  const hoursSummary = await aggregateEmployeeHours(supabase, profile.company_id, start, end);

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, pay_rate, worker_type")
    .eq("company_id", profile.company_id);
  const profileById = new Map((profileRows ?? []).map((p) => [p.id, p]));

  const workers = hoursSummary
    .map((e) => {
      const p = profileById.get(e.userId);
      const payRate = p?.pay_rate != null ? Number(p.pay_rate) : null;
      const workerType = (p?.worker_type as "w2" | "1099") ?? "w2";
      const grossPay = payRate != null ? Math.round(e.totalHours * payRate * 100) / 100 : null;
      return {
        userId: e.userId,
        employeeName: e.employeeName,
        workerType,
        payRate,
        billableHours: e.billableHours,
        nonBillableHours: e.nonBillableHours,
        totalHours: e.totalHours,
        grossPay,
      };
    })
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  // Revenue is counted on a cash basis — each payment on the day it was
  // received, not by invoice_date or job dates. A deposit taken in March on a
  // job paid off in May counts half in each month.
  const { data: paymentRows } = await supabase
    .from("payments")
    .select("id, amount, paid_on, method, invoice_id, quote_id")
    .eq("company_id", profile.company_id)
    .gte("paid_on", start)
    .lte("paid_on", end);

  const invoiceIds = [...new Set((paymentRows ?? []).map((p) => p.invoice_id).filter(Boolean))] as string[];
  const quoteIds = [...new Set((paymentRows ?? []).map((p) => p.quote_id).filter(Boolean))] as string[];
  const [{ data: invoiceRows }, { data: quoteRows }] = await Promise.all([
    invoiceIds.length
      ? supabase.from("invoices").select("id, invoice_number, client_name").eq("company_id", profile.company_id).in("id", invoiceIds)
      : Promise.resolve({ data: [] as { id: string; invoice_number: string; client_name: string }[] }),
    quoteIds.length
      ? supabase.from("quotes").select("id, quote_number, client").eq("company_id", profile.company_id).in("id", quoteIds)
      : Promise.resolve({ data: [] as { id: string; quote_number: string | null; client: string | null }[] }),
  ]);
  const invoiceById = new Map((invoiceRows ?? []).map((i) => [i.id, i]));
  const quoteById = new Map((quoteRows ?? []).map((q) => [q.id, q]));

  const payments = (paymentRows ?? [])
    .map((p) => {
      const inv = p.invoice_id ? invoiceById.get(p.invoice_id) : undefined;
      const quote = p.quote_id ? quoteById.get(p.quote_id) : undefined;
      return {
        id: p.id as string,
        // Shown as "#INV-2026-004" or "Quote #Q-2026-002 deposit"
        reference: inv ? `#${inv.invoice_number}` : quote ? `Quote #${quote.quote_number ?? ""} deposit` : "",
        clientName: inv?.client_name ?? quote?.client ?? "",
        paidOn: p.paid_on as string,
        amount: Number(p.amount),
      };
    })
    .sort((a, b) => b.paidOn.localeCompare(a.paidOn));

  const totalRevenue = Math.round(payments.reduce((s, p) => s + p.amount, 0) * 100) / 100;

  // Expenses — materials, equipment, subcontractors, etc. Two sources (see
  // supabase-schema.sql section 28): admin-entered rows in `expenses`
  // (counted by incurred_on), and employee-logged ones embedded on
  // timesheets (counted by submission date). Both make "Net" below
  // revenue minus payroll minus actual costs, not just revenue minus payroll.
  const { data: expenseRows } = await supabase
    .from("expenses")
    .select("id, job_id, amount, category, note, incurred_on")
    .eq("company_id", profile.company_id)
    .gte("incurred_on", start)
    .lte("incurred_on", end);

  const expenseJobIds = [...new Set((expenseRows ?? []).map((e) => e.job_id).filter(Boolean))] as string[];
  const { data: expenseJobRows } = expenseJobIds.length
    ? await supabase.from("job_events").select("id, title").eq("company_id", profile.company_id).in("id", expenseJobIds)
    : { data: [] as { id: string; title: string }[] };
  const jobTitleById = new Map((expenseJobRows ?? []).map((j) => [j.id, j.title]));

  const manualExpenses = (expenseRows ?? []).map((e) => ({
    id: e.id as string,
    reference: e.job_id ? jobTitleById.get(e.job_id) ?? "" : "",
    label: categoryLabel(e.category as string) + (e.note ? ` · ${e.note}` : ""),
    date: e.incurred_on as string,
    amount: Number(e.amount),
  }));

  const timesheetExpenses = await aggregateTimesheetExpenses(supabase, profile.company_id, start, end);
  const timesheetExpenseRows = timesheetExpenses.map((e) => ({
    id: e.id,
    reference: e.jobTitle ?? "",
    label: `${categoryLabel(e.category)} · ${e.employeeName}${e.note ? ` — ${e.note}` : ""}`,
    date: e.date,
    amount: e.amount,
  }));

  const expenses = [...manualExpenses, ...timesheetExpenseRows].sort((a, b) => b.date.localeCompare(a.date));
  const totalExpenses = Math.round(expenses.reduce((s, e) => s + e.amount, 0) * 100) / 100;

  return NextResponse.json({
    start,
    end,
    workers,
    revenue: { total: totalRevenue, payments },
    expenses: { total: totalExpenses, items: expenses },
  });
}
