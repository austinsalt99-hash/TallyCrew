import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { scheduleToUser } from "@/lib/onesignal";

function getLocalDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date);
}

// Convert a local date + HH:MM time in a given timezone to a UTC Date.
// Works by checking the UTC offset via Intl and correcting for it.
function localToUTC(localDateStr: string, sendTime: string, timezone: string): Date {
  const [h, m] = sendTime.split(":").map(Number);
  const naive = new Date(`${localDateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);
  const localHStr = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false,
  }).format(naive);
  const localH = parseInt(localHStr) % 24;
  const shiftMs = (h - localH) * 3600000;
  return new Date(naive.getTime() + shiftMs);
}

function formatTime(time: string | null): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const d = new Date(2000, 0, 1, h, m, 0, 0);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date();
  // Look 25 hours ahead to catch all timezones regardless of when exactly the cron fires
  const windowEnd = new Date(now.getTime() + 25 * 3600000);

  const { data: companies } = await supabase
    .from("companies")
    .select("id, timezone, morning_digest_time, morning_digest_last_sent_date");

  if (!companies?.length) return NextResponse.json({ ok: true, scheduled: 0 });

  let scheduled = 0;

  for (const company of companies) {
    const timezone = company.timezone ?? "America/Vancouver";
    const digestTime = company.morning_digest_time ?? "07:00";

    // Check today and tomorrow in this company's timezone, same reasoning as the
    // reminders cron: midnight UTC can be "today" for some timezones and
    // "yesterday" for others, so offset 0 and 1 together cover all cases.
    for (const dayOffset of [0, 1]) {
      const checkDate = new Date(now.getTime() + dayOffset * 86400000);
      const localDate = getLocalDate(checkDate, timezone);

      if (company.morning_digest_last_sent_date === localDate) continue;

      const fireUTC = localToUTC(localDate, digestTime, timezone);
      if (fireUTC <= now || fireUTC > windowEnd) continue;

      const { data: workers } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("company_id", company.id)
        .eq("role", "worker");

      const { data: events } = await supabase
        .from("job_events")
        .select("title, start_time, assigned_to")
        .eq("company_id", company.id)
        .eq("date", localDate)
        .order("start_time");

      if (workers?.length && events?.length) {
        for (const worker of workers) {
          if (!worker.full_name) continue;

          const myEvents = events.filter(
            (ev) =>
              ev.assigned_to
                ?.toLowerCase()
                .includes(worker.full_name.toLowerCase())
          );

          if (!myEvents.length) continue;

          const MAX_SHOWN = 3;
          const shown = myEvents.slice(0, MAX_SHOWN);
          const overflow = myEvents.length - MAX_SHOWN;

          const parts = shown.map((ev) => {
            const time = ev.start_time ? `${formatTime(ev.start_time)} – ` : "";
            return `${time}${ev.title}`;
          });
          if (overflow > 0) parts.push(`…and ${overflow} more`);

          try {
            await scheduleToUser(worker.id, "Your jobs for today", parts.join(", "), fireUTC.toUTCString());
            scheduled++;
          } catch (err) {
            console.error("[morning-digest cron] scheduleToUser error:", err);
          }
        }
      }

      // Mark this date as processed so a cron retry doesn't double-schedule.
      await supabase
        .from("companies")
        .update({ morning_digest_last_sent_date: localDate })
        .eq("id", company.id);

      break; // only one digest date per company per run
    }
  }

  return NextResponse.json({ ok: true, scheduled });
}
