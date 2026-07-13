import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const APP_ID = process.env.ONESIGNAL_APP_ID;
  const REST_KEY = process.env.ONESIGNAL_REST_API_KEY;

  if (!APP_ID || !REST_KEY) {
    return NextResponse.json({ error: "Missing env vars", APP_ID: !!APP_ID, REST_KEY: !!REST_KEY });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") ?? "subscribers";

  if (mode === "subscribers") {
    const res = await fetch(`https://onesignal.com/api/v1/players?app_id=${APP_ID}&limit=10`, {
      headers: { Authorization: `Key ${REST_KEY}` },
    });
    const json = await res.json();
    const simplified = (json.players ?? []).map((p: Record<string, unknown>) => ({
      id: p.id,
      device_type: p.device_type, // 0=iOS, 1=Android, 11=Chrome web
      identifier: p.identifier ? "HAS_TOKEN" : "NO_TOKEN",
      tags: p.tags,
      external_user_id: p.external_user_id,
      last_active: p.last_active,
      invalid_identifier: p.invalid_identifier,
    }));
    return NextResponse.json({ total: json.total_count, players: simplified });
  }

  // Send to all
  const res = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Key ${REST_KEY}` },
    body: JSON.stringify({
      app_id: APP_ID,
      included_segments: ["Total Subscriptions"],
      headings: { en: "Test" },
      contents: { en: "Test notification" },
    }),
  });
  const json = await res.json();
  return NextResponse.json({ status: res.status, response: json });
}
