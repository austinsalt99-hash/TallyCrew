import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getSupabase } from "@/lib/supabase";
import { buildEmailHtml } from "@/lib/emailTemplate";
import type { BillableEntryData } from "@/components/BillableEntry";
import type { NonBillableEntryData } from "@/components/NonBillableEntry";

export async function POST(request: Request) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const body = await request.json();
    const {
      employeeName,
      date,
      billable,
      nonBillable,
      notes,
      totalBillableHours,
      totalNonBillableHours,
    } = body as {
      employeeName: string;
      date: string;
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
    const { error: dbError } = await getSupabase().from("submissions").insert({
      employee_name: employeeName,
      date,
      billable_entries: billable,
      non_billable_entries: nonBillable,
      notes,
      total_billable_hours: totalBillableHours,
      total_non_billable_hours: totalNonBillableHours,
    });

    if (dbError) {
      console.error("Supabase error:", dbError);
      return NextResponse.json({ error: "Failed to save record" }, { status: 500 });
    }

    // Send email
    const html = buildEmailHtml({
      employeeName,
      date,
      billable,
      nonBillable,
      notes,
      totalBillableHours,
      totalNonBillableHours,
    });

    const { error: emailError } = await resend.emails.send({
      from: "CEW Hours <onboarding@resend.dev>",
      to: process.env.RECIPIENT_EMAIL!,
      subject: `Hours submitted: ${employeeName} – ${date}`,
      html,
    });

    if (emailError) {
      console.error("Resend error:", emailError);
      // Record saved but email failed — still return success, log the issue
      return NextResponse.json({ ok: true, emailWarning: "Saved but email failed to send" });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Submit error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
