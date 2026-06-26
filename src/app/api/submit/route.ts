import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import { buildEmailHtml } from "@/lib/emailTemplate";
import type { BillableEntryData } from "@/components/BillableEntry";
import type { NonBillableEntryData } from "@/components/NonBillableEntry";
import type { LogEntryType, LogEntryField, LogEntryFieldOption } from "@/types/logConfig";

async function fetchEntryTypesForCompany(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  companyId: string
): Promise<LogEntryType[]> {
  const { data: types } = await supabase
    .from("log_entry_types")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("sort_order");
  if (!types?.length) return [];

  const typeIds = types.map((t) => t.id);
  const { data: fields } = await supabase
    .from("log_entry_fields")
    .select("*")
    .in("type_id", typeIds)
    .order("sort_order");

  const fieldIds = (fields ?? []).map((f) => f.id);
  let options: LogEntryFieldOption[] = [];
  if (fieldIds.length) {
    const { data } = await supabase
      .from("log_entry_field_options")
      .select("*")
      .in("field_id", fieldIds)
      .order("sort_order");
    options = data ?? [];
  }

  return types.map((t) => ({
    ...t,
    fields: (fields ?? [])
      .filter((f) => f.type_id === t.id)
      .map((f): LogEntryField => ({ ...f, options: options.filter((o) => o.field_id === f.id) })),
  }));
}

export async function POST(request: Request) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const supabase = await createSupabaseServer();
    const { user, profile } = await getSessionUser(supabase);
    if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const {
      date,
      dayStartTime,
      dayEndTime,
      billable,
      nonBillable,
      dailyEntries,
      notes,
      totalBillableHours,
      totalNonBillableHours,
    } = body as {
      date: string;
      dayStartTime?: string;
      dayEndTime?: string;
      billable: BillableEntryData[];
      nonBillable: NonBillableEntryData[];
      dailyEntries?: object[];
      notes: string;
      totalBillableHours: number;
      totalNonBillableHours: number;
    };

    const employeeName = profile.full_name;

    if (!date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data: inserted, error: dbError } = await supabase
      .from("submissions")
      .insert({
        company_id: profile.company_id,
        user_id: user.id,
        employee_name: employeeName,
        date,
        day_start_time: dayStartTime || null,
        day_end_time: dayEndTime || null,
        billable_entries: billable,
        non_billable_entries: nonBillable,
        daily_entries: dailyEntries ?? [],
        notes,
        total_billable_hours: totalBillableHours,
        total_non_billable_hours: totalNonBillableHours,
      })
      .select("id")
      .single();

    if (dbError) {
      console.error("Supabase error:", dbError);
      return NextResponse.json({ error: "Failed to save record" }, { status: 500 });
    }
    const submissionId = inserted?.id as string;

    const entryTypes = await fetchEntryTypesForCompany(supabase, profile.company_id);
    const html = buildEmailHtml({
      employeeName,
      date,
      dayStartTime,
      dayEndTime,
      billable,
      nonBillable,
      notes,
      totalBillableHours,
      totalNonBillableHours,
      entryTypes,
    });

    const { error: emailError } = await resend.emails.send({
      from: "CEW Hours <onboarding@resend.dev>",
      to: process.env.RECIPIENT_EMAIL!,
      subject: `Hours submitted: ${employeeName} – ${date}`,
      html,
    });

    if (emailError) {
      console.error("Resend error:", emailError);
      return NextResponse.json({ ok: true, id: submissionId, emailWarning: "Saved but email failed to send" });
    }

    return NextResponse.json({ ok: true, id: submissionId });
  } catch (err) {
    console.error("Submit error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const supabase = await createSupabaseServer();
    const { user, profile } = await getSessionUser(supabase);
    if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const {
      id,
      date,
      dayStartTime,
      dayEndTime,
      billable,
      nonBillable,
      dailyEntries,
      notes,
      totalBillableHours,
      totalNonBillableHours,
    } = body as {
      id: string;
      date: string;
      dayStartTime?: string;
      dayEndTime?: string;
      billable: BillableEntryData[];
      nonBillable: NonBillableEntryData[];
      dailyEntries?: object[];
      notes: string;
      totalBillableHours: number;
      totalNonBillableHours: number;
    };

    const employeeName = profile.full_name;

    if (!id || !date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { error: dbError } = await supabase
      .from("submissions")
      .update({
        day_start_time: dayStartTime || null,
        day_end_time: dayEndTime || null,
        billable_entries: billable,
        non_billable_entries: nonBillable,
        daily_entries: dailyEntries ?? [],
        notes,
        total_billable_hours: totalBillableHours,
        total_non_billable_hours: totalNonBillableHours,
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (dbError) {
      console.error("Supabase update error:", dbError);
      return NextResponse.json({ error: "Failed to update record" }, { status: 500 });
    }

    const entryTypes = await fetchEntryTypesForCompany(supabase, profile.company_id);
    const html = buildEmailHtml({
      employeeName,
      date,
      dayStartTime,
      dayEndTime,
      billable,
      nonBillable,
      notes,
      totalBillableHours,
      totalNonBillableHours,
      entryTypes,
    });

    await resend.emails.send({
      from: "CEW Hours <onboarding@resend.dev>",
      to: process.env.RECIPIENT_EMAIL!,
      subject: `Hours updated: ${employeeName} – ${date}`,
      html,
    });

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("Update error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
