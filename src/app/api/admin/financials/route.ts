import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import { aggregateEmployeeHours } from "@/lib/payrollSummary";
import { addDaysToDateStr } from "@/lib/dateMath";

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

  // Revenue is counted on a cash basis — invoices actually marked paid within
  // the range, by paid_at, not by invoice_date or job dates. The end bound is
  // exclusive (< the day after `end`) so the whole end day counts regardless
  // of what time paid_at was stamped.
  const endExclusive = addDaysToDateStr(end, 1);
  const { data: paidInvoiceRows } = await supabase
    .from("invoices")
    .select("id, invoice_number, client_name, paid_at, total")
    .eq("company_id", profile.company_id)
    .eq("status", "paid")
    .gte("paid_at", start)
    .lt("paid_at", endExclusive);

  const paidInvoices = (paidInvoiceRows ?? [])
    .map((inv) => ({
      id: inv.id as string,
      invoiceNumber: inv.invoice_number as string,
      clientName: inv.client_name as string,
      paidAt: inv.paid_at as string,
      total: Number(inv.total),
    }))
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));

  const totalRevenue = Math.round(paidInvoices.reduce((s, inv) => s + inv.total, 0) * 100) / 100;

  return NextResponse.json({
    start,
    end,
    workers,
    revenue: { total: totalRevenue, invoices: paidInvoices },
  });
}
