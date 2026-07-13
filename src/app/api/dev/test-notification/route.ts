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
  const mode = searchParams.get("mode") ?? "direct";

  // Fetch the first subscriber's player ID
  const playersRes = await fetch(`https://onesignal.com/api/v1/players?app_id=${APP_ID}&limit=1`, {
    headers: { Authorization: `Key ${REST_KEY}` },
  });
  const playersJson = await playersRes.json();
  const player = playersJson.players?.[0];

  if (!player) return NextResponse.json({ error: "No subscribers found" });

  const payload =
    mode === "external"
      ? {
          app_id: APP_ID,
          include_external_user_ids: [player.external_user_id],
          channel_for_external_user_ids: "push",
          headings: { en: "Direct test (external ID)" },
          contents: { en: "Testing by external user ID" },
        }
      : {
          app_id: APP_ID,
          include_player_ids: [player.id],
          headings: { en: "Direct test (player ID)" },
          contents: { en: "Testing by OneSignal player ID" },
        };

  const res = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Key ${REST_KEY}` },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  return NextResponse.json({
    mode,
    player_id: player.id,
    external_user_id: player.external_user_id,
    device_type: player.device_type,
    invalid_identifier: player.invalid_identifier,
    status: res.status,
    response: json,
  });
}
