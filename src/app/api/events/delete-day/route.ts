import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import { addDaysToDateStr, daysBetweenDateStrs } from "@/lib/dateMath";

// Removes one worker's assignment to a single day of a job — the inverse of
// split-day's "move one day" operation. If the job spans multiple days, that
// range explodes into one row per day (same approach as split-day) so only
// the requested day is touched: every other day, and every other worker
// already assigned to that same day, is left exactly as it was. A day that
// ends up with no one left assigned to it is dropped entirely rather than
// kept as an empty row.
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { eventId, date, worker } = await request.json();
  if (!eventId || !date) {
    return NextResponse.json({ error: "eventId and date are required" }, { status: 400 });
  }

  const { data: ev, error: fetchErr } = await supabase
    .from("job_events")
    .select("*")
    .eq("id", eventId)
    .eq("company_id", profile.company_id)
    .single();
  if (fetchErr || !ev) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const rangeEnd: string = ev.end_date || ev.date;
  if (date < ev.date || date > rangeEnd) {
    return NextResponse.json({ error: "date is outside this job's span" }, { status: 400 });
  }

  // "Unassigned" isn't a real name to strip out of assigned_to — deleting an
  // unassigned day just removes that day's row outright.
  const workerToRemove: string | null = worker && worker !== "Unassigned" ? worker : null;
  const currentNames: string[] = (ev.assigned_to ?? "")
    .split(",")
    .map((n: string) => n.trim())
    .filter(Boolean);
  const remainingNames = workerToRemove
    ? currentNames.filter((n) => n.toLowerCase() !== workerToRemove.toLowerCase())
    : currentNames;
  const dayDeleted = workerToRemove ? remainingNames.length === 0 : true;
  const newAssignedTo = remainingNames.join(", ");

  // Already a single day — no range to preserve, just delete or reassign the row.
  if (ev.date === rangeEnd) {
    if (dayDeleted) {
      const { error } = await supabase
        .from("job_events")
        .delete()
        .eq("id", eventId)
        .eq("company_id", profile.company_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, deletedId: eventId, events: [] });
    }
    const { data: updated, error } = await supabase
      .from("job_events")
      .update({ assigned_to: newAssignedTo })
      .eq("id", eventId)
      .eq("company_id", profile.company_id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, events: [updated] });
  }

  // Multi-day — explode into per-day rows so only `date` is affected.
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
  const remainingDates = allDates.filter((d) => d !== date);
  const [keepDate, ...restDates] = remainingDates;

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

  const rowsToInsert = restDates.map((d) => ({ ...baseRow, date: d, end_date: null }));
  if (!dayDeleted) {
    rowsToInsert.push({ ...baseRow, date, end_date: null, assigned_to: newAssignedTo });
  }

  let inserted: Record<string, unknown>[] = [];
  if (rowsToInsert.length > 0) {
    const { data, error: insertErr } = await supabase
      .from("job_events")
      .insert(rowsToInsert)
      .select();
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
    inserted = data ?? [];
  }

  return NextResponse.json({ ok: true, events: [updatedOriginal, ...inserted] });
}
