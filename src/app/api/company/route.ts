import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createSupabaseServer();
  const { profile } = await getSessionUser(supabase);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("companies")
    .select("name, banner_url")
    .eq("id", profile.company_id)
    .single();

  return NextResponse.json(data ?? {});
}

export async function PATCH(req: Request) {
  const supabase = await createSupabaseServer();
  const { profile } = await getSessionUser(supabase);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { banner_url } = body;

  const { error } = await supabase
    .from("companies")
    .update({ banner_url })
    .eq("id", profile.company_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
