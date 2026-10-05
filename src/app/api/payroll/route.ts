import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import { aggregateEmployeeHours } from "@/lib/payrollSummary";

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");
  if (!start || !end) return NextResponse.json({ error: "start and end required" }, { status: 400 });

  const hoursSummary = await aggregateEmployeeHours(supabase, profile.company_id, start, end);

  const userIds = hoursSummary.map((e) => e.userId);
  const payRateByUser = new Map<string, number>();
  if (userIds.length > 0) {
    const { data: rateRows } = await supabase
      .from("profiles")
      .select("id, pay_rate")
      .in("id", userIds);
    for (const r of rateRows ?? []) {
      if (r.pay_rate != null) payRateByUser.set(r.id, Number(r.pay_rate));
    }
  }

  const employees = hoursSummary.map((e) => {
    const payRate = payRateByUser.get(e.userId) ?? null;
    const grossPay = payRate != null ? Math.round(e.totalHours * payRate * 100) / 100 : null;
    return { ...e, payRate, grossPay };
  });

  const { data: periodRow } = await supabase
    .from("payroll_periods")
    .select("paid_at")
    .eq("company_id", profile.company_id)
    .eq("period_start", start)
    .eq("period_end", end)
    .maybeSingle();

  return NextResponse.json({
    periodStart: start,
    periodEnd: end,
    paid: !!periodRow?.paid_at,
    paidAt: periodRow?.paid_at ?? null,
    employees,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { periodStart, periodEnd, paid } = await req.json();
  if (!periodStart || !periodEnd) return NextResponse.json({ error: "periodStart and periodEnd required" }, { status: 400 });

  const { error } = await supabase
    .from("payroll_periods")
    .upsert(
      {
        company_id: profile.company_id,
        period_start: periodStart,
        period_end: periodEnd,
        paid_at: paid ? new Date().toISOString() : null,
        paid_by: paid ? user.id : null,
      },
      { onConflict: "company_id,period_start,period_end" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, paid: !!paid });
}
