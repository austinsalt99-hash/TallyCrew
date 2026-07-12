import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, body, pinned, created_at")
    .eq("company_id", profile.company_id)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { title, body: text, pinned } = body as { title: string; body?: string; pinned?: boolean };
  if (!title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const { data, error } = await supabase
    .from("announcements")
    .insert({
      company_id: profile.company_id,
      title: title.trim(),
      body: text?.trim() || null,
      pinned: pinned ?? false,
      created_by: user.id,
    })
    .select("id, title, body, pinned, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { sendToCompany } = await import("@/lib/onesignal");
  sendToCompany(
    profile.company_id,
    data.title,
    data.body ?? "New announcement"
  ).catch(console.error);

  return NextResponse.json(data, { status: 201 });
}
