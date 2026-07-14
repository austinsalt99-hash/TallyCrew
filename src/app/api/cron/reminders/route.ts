import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendToUser, sendToCompany } from "@/lib/onesignal";

function getLocalDateParts(timezone: string): { dateStr: string; timeStr: string; dow: number } {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(now);

  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";

  const DOW_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = DOW_MAP[weekday] ?? 0;

  return { dateStr, timeStr: `${hour.padStart(2, "0")}:00`, dow };
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

  const { data: companies } = await supabase.from("companies").select("id, timezone");
  if (!companies?.length) return NextResponse.json({ ok: true, sent: 0 });

  let sent = 0;

  for (const company of companies) {
    const timezone = company.timezone ?? "America/Toronto";
    const { dateStr, timeStr, dow } = getLocalDateParts(timezone);

    const { data: reminders } = await supabase
      .from("reminders")
      .select("id, title, body, target_type, target_user_ids, send_time, days_of_week, last_sent_date")
      .eq("company_id", company.id)
      .eq("active", true)
      .eq("send_time", timeStr)
      .contains("days_of_week", [dow]);

    if (!reminders?.length) continue;

    for (const reminder of reminders) {
      // Skip if already sent today
      if (reminder.last_sent_date === dateStr) continue;

      try {
        if (reminder.target_type === "all") {
          await sendToCompany(company.id, reminder.title, reminder.body ?? reminder.title);
        } else if (reminder.target_user_ids?.length) {
          for (const userId of reminder.target_user_ids) {
            await sendToUser(userId, reminder.title, reminder.body ?? reminder.title);
          }
        }

        await supabase
          .from("reminders")
          .update({ last_sent_date: dateStr })
          .eq("id", reminder.id);

        sent++;
      } catch (err) {
        console.error("[cron/reminders] send error:", err);
      }
    }
  }

  return NextResponse.json({ ok: true, sent });
}
