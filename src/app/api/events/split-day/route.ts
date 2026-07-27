import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import { addDaysToDateStr, daysBetweenDateStrs } from "@/lib/dateMath";

// Moves a single day of a job to a new date. If the job is still a
// contiguous multi-day range, that range explodes into one row per day
// (linked via ongoing_job_id) — once a job has had a day pulled out of it,
// every day stands on its own rather than trying to keep the untouched
// remainder as a shrinking range that would need re-splitting on every
// subsequent move. The original row's id is kept for one of the remaining
// days (rather than deleted) so any timesheet entry already linked to it
// keeps resolving correctly.
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { eventId, extractedDate, targetDate, assignedTo, startTime, endTime } = await request.json();
  if (!eventId || !extractedDate || !targetDate) {
    return NextResponse.json({ error: "eventId, extractedDate and targetDate are required" }, { status: 400 });
  }

  const { data: ev, error: fetchErr } = await supabase
    .from("job_events")
    .select("*")
    .eq("id", eventId)
    .eq("company_id", profile.company_id)
    .single();
  if (fetchErr || !ev) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const rangeEnd: string = ev.end_date || ev.date;
  const movedOverrides: Record<string, unknown> = {};
  if (assignedTo !== undefined) movedOverrides.assigned_to = assignedTo;
  if (startTime !== undefined) movedOverrides.start_time = startTime;
  if (endTime !== undefined) movedOverrides.end_time = endTime;

  // Already a single day (either never spanned multiple days, or a prior
  // split already exploded it) — this is just a plain move, no explosion.
  if (ev.date === rangeEnd) {
    const { data: updated, error } = await supabase
      .from("job_events")
      .update({ date: targetDate, ...movedOverrides })
      .eq("id", eventId)
      .eq("company_id", profile.company_id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, events: [updated] });
  }

  if (extractedDate < ev.date || extractedDate > rangeEnd) {
    return NextResponse.json({ error: "extractedDate is outside this job's span" }, { status: 400 });
  }

  let ongoingJobId: string | null = ev.ongoing_job_id ?? null;
  if (!ongoingJobId) {
    const { data: created, error } = await supabase
      .from("ongoing_jobs")
      .insert({
        company_id: profile.company_id,
        title: ev.title,
        client: ev.client || null,
        location: ev.location || null,
        description: ev.description || null,
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    ongoingJobId = created.id;
  }

  const totalDays = daysBetweenDateStrs(rangeEnd, ev.date) + 1;
  const allDates = Array.from({ length: totalDays }, (_, i) => addDaysToDateStr(ev.date, i));
  const remaining = allDates.filter((d) => d !== extractedDate);
  const [keepDate, ...restDates] = remaining;

  const baseRow = {
    company_id: profile.company_id,
    title: ev.title,
    client: ev.client,
    location: ev.location,
    description: ev.description,
    start_time: ev.start_time,
    end_time: ev.end_time,
    assigned_to: ev.assigned_to,
    is_verified: ev.is_verified,
    ongoing_job_id: ongoingJobId,
  };

  const { data: updatedOriginal, error: updateErr } = await supabase
    .from("job_events")
    .update({ date: keepDate, end_date: null, ongoing_job_id: ongoingJobId })
    .eq("id", eventId)
    .eq("company_id", profile.company_id)
    .select()
    .single();
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  const rowsToInsert = [
    ...restDates.map((d) => ({ ...baseRow, date: d, end_date: null })),
    { ...baseRow, date: targetDate, end_date: null, ...movedOverrides },
  ];

  const { data: inserted, error: insertErr } = await supabase
    .from("job_events")
    .insert(rowsToInsert)
    .select();
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, events: [updatedOriginal, ...(inserted ?? [])] });
}
