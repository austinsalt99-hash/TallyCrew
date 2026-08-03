import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import { parseVoiceEventText } from "@/lib/parseVoiceEvent";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!checkRateLimit(`parse-event:${user.id}`, 20, 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const { text } = await request.json();
  if (!text?.trim()) return NextResponse.json({ error: "No text provided" }, { status: 400 });

  const { data: crew } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("company_id", profile.company_id);
  const crewNames = (crew ?? []).map((p) => p.full_name).filter(Boolean);

  try {
    const parsed = await parseVoiceEventText(text, crewNames);
    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to parse AI response" }, { status: 500 });
  }
}
