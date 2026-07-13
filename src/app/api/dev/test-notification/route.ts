import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const APP_ID = process.env.ONESIGNAL_APP_ID;
  const REST_KEY = process.env.ONESIGNAL_REST_API_KEY;
  if (!APP_ID || !REST_KEY) return NextResponse.json({ error: "Missing env vars" });

  const { searchParams } = new URL(request.url);
  const notifId = searchParams.get("check");

  // Check existing notification status
  if (notifId) {
    const res = await fetch(`https://onesignal.com/api/v1/notifications/${notifId}?app_id=${APP_ID}`, {
      headers: { Authorization: `Key ${REST_KEY}` },
    });
    const json = await res.json();
    return NextResponse.json({
      id: json.id,
      successful: json.successful,
      failed: json.failed,
      errored: json.errored,
      converted: json.converted,
      remaining: json.remaining,
      errors: json.errors,
      platform_delivery_stats: json.platform_delivery_stats,
    });
  }

  // Send direct notification and return ID to check
  const playersRes = await fetch(`https://onesignal.com/api/v1/players?app_id=${APP_ID}&limit=1`, {
    headers: { Authorization: `Key ${REST_KEY}` },
  });
  const playersJson = await playersRes.json();
  const player = playersJson.players?.[0];
  if (!player) return NextResponse.json({ error: "No subscribers" });

  const sendRes = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Key ${REST_KEY}` },
    body: JSON.stringify({
      app_id: APP_ID,
      include_player_ids: [player.id],
      headings: { en: "Direct test" },
      contents: { en: "Testing delivery" },
    }),
  });
  const sendJson = await sendRes.json();
  const id = sendJson.id;

  // Wait 3 seconds then check status
  await sleep(3000);

  const checkRes = await fetch(`https://onesignal.com/api/v1/notifications/${id}?app_id=${APP_ID}`, {
    headers: { Authorization: `Key ${REST_KEY}` },
  });
  const checkJson = await checkRes.json();

  return NextResponse.json({
    notification_id: id,
    successful: checkJson.successful,
    failed: checkJson.failed,
    errored: checkJson.errored,
    errors: checkJson.errors,
    platform_delivery_stats: checkJson.platform_delivery_stats,
  });
}
