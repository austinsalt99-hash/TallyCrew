import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";

function calcHours(start?: string, end?: string, manual?: number | null): number {
  if (manual != null) return manual;
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  return Math.max(0, Math.round((mins / 60) * 100) / 100);
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const eventId = req.nextUrl.searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

  // Fetch the job event
  const { data: event } = await supabase
    .from("job_events")
    .select("id, title, client, date, location, description")
    .eq("id", eventId)
    .eq("company_id", profile.company_id)
    .single();

  if (!event) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // Fetch all submissions linked to this event via JSONB containment
  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, employee_name, date, billable_entries")
    .eq("company_id", profile.company_id)
    .filter("billable_entries", "cs", JSON.stringify([{ linkedEventId: eventId }]));

  // Build slug → name map from log_entry_types
  const { data: logTypes } = await supabase
    .from("log_entry_types")
    .select("slug, name")
    .eq("company_id", profile.company_id);

  const slugToName: Record<string, string> = {};
  for (const t of logTypes ?? []) slugToName[t.slug] = t.name;

  const lineItems: {
    id: string;
    description: string;
    employee: string;
    date: string;
    hours: number;
    amount: string;
    sourceJobId: string;
    sourceJobTitle: string;
  }[] = [];

  for (const sub of submissions ?? []) {
    const entries = (sub.billable_entries as Record<string, unknown>[]) ?? [];
    for (const entry of entries) {
      if ((entry.linkedEventId as string) !== eventId) continue;

      const entryDesc = (entry.description as string) || "";
      const isNewFormat = entry.subEntries != null;

      if (isNewFormat) {
        const subEntries = (entry.subEntries as Record<string, unknown>[]) ?? [];
        if (subEntries.length > 0) {
          for (const sub2 of subEntries) {
            const slug = sub2.slug as string;
            const typeName = slugToName[slug] ?? slug;
            const hours = calcHours(
              sub2.startTime as string | undefined,
              sub2.endTime as string | undefined,
              sub2.manualHours as number | null | undefined,
            );
            lineItems.push({
              id: crypto.randomUUID(),
              description: typeName + (entryDesc ? ` – ${entryDesc}` : ""),
              employee: sub.employee_name,
              date: sub.date,
              hours,
              amount: "",
              sourceJobId: eventId,
              sourceJobTitle: event.title,
            });
          }
        } else {
          // New format with no sub-entries — use top-level time
          const hours = calcHours(
            entry.startTime as string | undefined,
            entry.endTime as string | undefined,
            entry.manualHours as number | null | undefined,
          );
          lineItems.push({
            id: crypto.randomUUID(),
            description: entryDesc,
            employee: sub.employee_name,
            date: sub.date,
            hours,
            amount: "",
            sourceJobId: eventId,
            sourceJobTitle: event.title,
          });
        }
      } else {
        // Old format
        const hours = calcHours(
          entry.startTime as string | undefined,
          entry.endTime as string | undefined,
          entry.manualHours as number | null | undefined,
        );
        lineItems.push({
          id: crypto.randomUUID(),
          description: entryDesc || (entry.client as string) || "",
          employee: sub.employee_name,
          date: sub.date,
          hours,
          amount: "",
          sourceJobId: eventId,
          sourceJobTitle: event.title,
        });
      }
    }
  }

  lineItems.sort((a, b) => a.date.localeCompare(b.date) || a.employee.localeCompare(b.employee));

  return NextResponse.json({ event, lineItems });
}
