import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const APP_ID = process.env.ONESIGNAL_APP_ID!;
const REST_KEY = process.env.ONESIGNAL_REST_API_KEY!;

async function scheduleNotification(payload: Record<string, unknown>): Promise<void> {
  const res = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${REST_KEY}`,
    },
    body: JSON.stringify({ app_id: APP_ID, ...payload }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("[reminders cron] OneSignal error:", res.status, text);
  }
}

function getLocalDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date);
}

function getLocalDow(date: Date, timezone: string): number {
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(date);
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[day] ?? 0;
}

// Convert a local date + HH:00 time in a given timezone to a UTC Date.
// Works by checking the UTC offset via Intl and correcting for it.
function localToUTC(localDateStr: string, sendTime: string, timezone: string): Date {
  const [h] = sendTime.split(":").map(Number);
  const naive = new Date(`${localDateStr}T${String(h).padStart(2, "0")}:00:00Z`);
  const localHStr = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false,
  }).format(naive);
  const localH = parseInt(localHStr) % 24;
  const shiftMs = (h - localH) * 3600000;
  return new Date(naive.getTime() + shiftMs);
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

  const { data: companies } = await supabase.from("companies").select("id, timezone");
  if (!companies?.length) return NextResponse.json({ ok: true, scheduled: 0 });

  let scheduled = 0;

  for (const company of companies) {
    const timezone = company.timezone ?? "America/Toronto";

    const { data: reminders } = await supabase
      .from("reminders")
      .select("id, title, body, target_type, target_user_ids, send_time, days_of_week, one_off_date, last_sent_date")
      .eq("company_id", company.id)
      .eq("active", true);

    if (!reminders?.length) continue;

    // Check today and tomorrow in this company's timezone.
    // We check two days because midnight UTC can be "today" for some timezones
    // and "yesterday" for others, so offset=0 and offset=1 together cover all cases.
    for (const dayOffset of [0, 1]) {
      const checkDate = new Date(now.getTime() + dayOffset * 86400000);
      const localDate = getLocalDate(checkDate, timezone);
      const dow = getLocalDow(checkDate, timezone);

      for (const reminder of reminders) {
        const isOneOff = !!reminder.one_off_date;
        if (isOneOff) {
          if (reminder.one_off_date !== localDate) continue;
        } else if (!(reminder.days_of_week as number[] | null)?.includes(dow)) {
          continue;
        }
        if (reminder.last_sent_date === localDate) continue;

        const fireUTC = localToUTC(localDate, reminder.send_time, timezone);

        // Only schedule if the fire time falls inside our 25-hour window
        if (fireUTC <= now || fireUTC > windowEnd) continue;

        try {
          const base = {
            headings: { en: reminder.title },
            contents: { en: reminder.body ?? reminder.title },
            send_after: fireUTC.toUTCString(),
          };

          if (reminder.target_type === "all") {
            await scheduleNotification({
              ...base,
              filters: [{ field: "tag", key: "company_id", relation: "=", value: company.id }],
            });
          } else if ((reminder.target_user_ids as string[] | null)?.length) {
            await scheduleNotification({
              ...base,
              include_external_user_ids: reminder.target_user_ids,
              channel_for_external_user_ids: "push",
            });
          }

          // Mark as scheduled for today so a cron retry doesn't double-schedule.
          // One-off reminders deactivate after their single send.
          await supabase
            .from("reminders")
            .update(isOneOff ? { last_sent_date: localDate, active: false } : { last_sent_date: localDate })
            .eq("id", reminder.id);

          scheduled++;
        } catch (err) {
          console.error("[reminders cron] error scheduling reminder:", reminder.id, err);
        }
      }
    }
  }

  return NextResponse.json({ ok: true, scheduled });
}
