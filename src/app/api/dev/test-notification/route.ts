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

  const playersRes = await fetch(`https://onesignal.com/api/v1/players?app_id=${APP_ID}&limit=1`, {
    headers: { Authorization: `Key ${REST_KEY}` },
  });
  const playersJson = await playersRes.json();
  const player = playersJson.players?.[0];
  if (!player) return NextResponse.json({ error: "No subscribers" });

  // Fetch full player details to check token type
  const playerDetailRes = await fetch(`https://onesignal.com/api/v1/players/${player.id}?app_id=${APP_ID}`, {
    headers: { Authorization: `Key ${REST_KEY}` },
  });
  const playerDetail = await playerDetailRes.json();

  const tagCompanyId = playerDetail.tags?.company_id;
  const sessionCompanyId = profile.company_id;

  // Test 1: direct by player ID
  const directRes = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Key ${REST_KEY}` },
    body: JSON.stringify({
      app_id: APP_ID,
      include_player_ids: [player.id],
      headings: { en: "Direct test" },
      contents: { en: "Testing delivery (direct)" },
    }),
  });
  const directId = (await directRes.json()).id;

  // Test 2: filter by company_id tag using SESSION company_id (exactly like announcement route)
  const filterRes = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Key ${REST_KEY}` },
    body: JSON.stringify({
      app_id: APP_ID,
      filters: [{ field: "tag", key: "company_id", relation: "=", value: sessionCompanyId }],
      headings: { en: "Filter test" },
      contents: { en: "Testing delivery (filter)" },
    }),
  });
  const filterSendJson = await filterRes.json();
  const filterId = filterSendJson.id;

  await sleep(5000);

  const [directCheck, filterCheck] = await Promise.all([
    fetch(`https://onesignal.com/api/v1/notifications/${directId}?app_id=${APP_ID}`, {
      headers: { Authorization: `Key ${REST_KEY}` },
    }).then(r => r.json()),
    filterId
      ? fetch(`https://onesignal.com/api/v1/notifications/${filterId}?app_id=${APP_ID}`, {
          headers: { Authorization: `Key ${REST_KEY}` },
        }).then(r => r.json())
      : Promise.resolve(filterSendJson),
  ]);

  return NextResponse.json({
    session_company_id: sessionCompanyId,
    player: {
      id: playerDetail.id,
      test_type: playerDetail.test_type,
      tag_company_id: tagCompanyId,
      ids_match: tagCompanyId === sessionCompanyId,
    },
    direct: { successful: directCheck.successful, failed: directCheck.failed, errored: directCheck.errored },
    filter: { successful: filterCheck.successful, failed: filterCheck.failed, errored: filterCheck.errored, errors: filterCheck.errors },
  });
}
