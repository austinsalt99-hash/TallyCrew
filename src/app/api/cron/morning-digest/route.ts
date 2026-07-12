import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendToUser } from "@/lib/onesignal";

function getHourInTimezone(timezone: string): number {
  try {
    return parseInt(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        hour12: false,
      }).format(new Date()),
      10
    );
  } catch {
    return -1;
  }
}

function getTodayInTimezone(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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

  const { data: companies } = await supabase
    .from("companies")
    .select("id, timezone");

  if (!companies?.length) return NextResponse.json({ ok: true, sent: 0 });

  let sent = 0;

  for (const company of companies) {
    const timezone = company.timezone ?? "America/Toronto";

    if (getHourInTimezone(timezone) !== 7) continue;

    const today = getTodayInTimezone(timezone);

    const { data: workers } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("company_id", company.id)
      .eq("role", "worker");

    if (!workers?.length) continue;

    const { data: events } = await supabase
      .from("job_events")
      .select("title, start_time, assigned_to")
      .eq("company_id", company.id)
      .eq("date", today)
      .order("start_time");

    if (!events?.length) continue;

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
        await sendToUser(worker.id, "Your jobs for today", parts.join(", "));
        sent++;
      } catch (err) {
        console.error("[cron] sendToUser error:", err);
      }
    }
  }

  return NextResponse.json({ ok: true, sent });
}
