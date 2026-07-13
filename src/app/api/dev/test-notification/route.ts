import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const APP_ID = process.env.ONESIGNAL_APP_ID;
  const REST_KEY = process.env.ONESIGNAL_REST_API_KEY;

  if (!APP_ID || !REST_KEY) {
    return NextResponse.json({ error: "Missing env vars", APP_ID: !!APP_ID, REST_KEY: !!REST_KEY });
  }

  const payload = {
    app_id: APP_ID,
    filters: [{ field: "tag", key: "company_id", relation: "=", value: profile.company_id }],
    headings: { en: "Test notification" },
    contents: { en: `Sent to company ${profile.company_id}` },
  };

  const res = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${REST_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  return NextResponse.json({ status: res.status, response: json, company_id: profile.company_id });
}
