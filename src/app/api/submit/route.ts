import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getSupabase } from "@/lib/supabase";
import { buildEmailHtml } from "@/lib/emailTemplate";
import type { BillableEntryData } from "@/components/BillableEntry";
import type { NonBillableEntryData } from "@/components/NonBillableEntry";
import type { LogEntryType, LogEntryField, LogEntryFieldOption } from "@/types/logConfig";

async function fetchEntryTypes(): Promise<LogEntryType[]> {
  const sb = getSupabase();
  const { data: types } = await sb
    .from("log_entry_types")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (!types?.length) return [];

  const typeIds = types.map((t) => t.id);
  const { data: fields } = await sb
    .from("log_entry_fields")
    .select("*")
    .in("type_id", typeIds)
    .order("sort_order");

  const fieldIds = (fields ?? []).map((f) => f.id);
  let options: LogEntryFieldOption[] = [];
  if (fieldIds.length) {
    const { data } = await sb
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
    const body = await request.json();
    const {
      employeeName,
      date,
      dayStartTime,
      dayEndTime,
      billable,
      nonBillable,
      notes,
      totalBillableHours,
      totalNonBillableHours,
    } = body as {
      employeeName: string;
      date: string;
      dayStartTime?: string;
      dayEndTime?: string;
      billable: BillableEntryData[];
      nonBillable: NonBillableEntryData[];
      notes: string;
      totalBillableHours: number;
      totalNonBillableHours: number;
    };

    if (!employeeName || !date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Save to Supabase
    const { data: inserted, error: dbError } = await getSupabase()
      .from("submissions")
      .insert({
        employee_name: employeeName,
        date,
        day_start_time: dayStartTime || null,
        day_end_time: dayEndTime || null,
        billable_entries: billable,
        non_billable_entries: nonBillable,
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

    // Fetch type config to produce readable field labels in the email
    const entryTypes = await fetchEntryTypes();

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
    const body = await request.json();
    const {
      id,
      employeeName,
      date,
      dayStartTime,
      dayEndTime,
      billable,
      nonBillable,
      notes,
      totalBillableHours,
      totalNonBillableHours,
    } = body as {
      id: string;
      employeeName: string;
      date: string;
      dayStartTime?: string;
      dayEndTime?: string;
      billable: BillableEntryData[];
      nonBillable: NonBillableEntryData[];
      notes: string;
      totalBillableHours: number;
      totalNonBillableHours: number;
    };

    if (!id || !employeeName || !date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { error: dbError } = await getSupabase()
      .from("submissions")
      .update({
        day_start_time: dayStartTime || null,
        day_end_time: dayEndTime || null,
        billable_entries: billable,
        non_billable_entries: nonBillable,
        notes,
        total_billable_hours: totalBillableHours,
        total_non_billable_hours: totalNonBillableHours,
      })
      .eq("id", id);

    if (dbError) {
      console.error("Supabase update error:", dbError);
      return NextResponse.json({ error: "Failed to update record" }, { status: 500 });
    }

    const entryTypes = await fetchEntryTypes();

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
