import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { parseVoiceEventText } from "@/lib/parseVoiceEvent";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// Called by the iOS Siri Shortcut (App Intent), not the browser — there is no
// Supabase session cookie here, so auth is a bearer token minted in
// /api/admin/settings/siri-token and stored in the phone's Keychain.
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });

  const { text } = await request.json();
  if (!text?.trim()) return NextResponse.json({ error: "No text provided" }, { status: 400 });

  const supabase = createSupabaseAdmin();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, company_id, role")
    .eq("siri_token_hash", hashToken(token))
    .single();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { data: crew } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("company_id", profile.company_id);
  const crewNames = (crew ?? []).map((p) => p.full_name).filter(Boolean);

  let parsed;
  try {
    parsed = await parseVoiceEventText(text, crewNames);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to parse voice input" }, { status: 500 });
  }

  if (!parsed.title?.trim() || !parsed.date?.trim()) {
    return NextResponse.json({ error: "Could not make out a job title and date from that" }, { status: 422 });
  }

  const { data, error } = await supabase
    .from("job_events")
    .insert({
      company_id: profile.company_id,
      date: parsed.date,
      title: parsed.title,
      client: parsed.client || null,
      location: parsed.location || null,
      description: parsed.description || null,
      start_time: parsed.start_time || null,
      end_time: parsed.end_time || null,
      assigned_to: parsed.assigned_to || null,
      is_verified: false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, event: data });
}
