import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import { parseVoiceEventText } from "@/lib/parseVoiceEvent";

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { text } = await request.json();
  if (!text?.trim()) return NextResponse.json({ error: "No text provided" }, { status: 400 });

  try {
    const parsed = await parseVoiceEventText(text);
    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to parse AI response" }, { status: 500 });
  }
}
