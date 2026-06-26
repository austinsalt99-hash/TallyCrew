import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);

  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Generate a unique code (retry up to 5 times on collision)
  let code = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    code = generateCode();
    const { data: existing } = await supabase
      .from("invite_codes")
      .select("id")
      .eq("code", code)
      .single();
    if (!existing) break;
  }

  const { data, error } = await supabase
    .from("invite_codes")
    .insert({
      company_id: profile.company_id,
      code,
      created_by: profile.id,
    })
    .select("id, code, created_at")
    .single();

  if (error || !data) {
    console.error("Invite insert error:", error);
    return NextResponse.json({ error: "Failed to generate invite code." }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);

  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("invite_codes")
    .select("id, code, created_at, used_at, is_active, used_by")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Failed to fetch codes." }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function DELETE(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);

  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const { error } = await supabase
    .from("invite_codes")
    .update({ is_active: false })
    .eq("id", id)
    .eq("company_id", profile.company_id);

  if (error) return NextResponse.json({ error: "Failed to revoke code." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
