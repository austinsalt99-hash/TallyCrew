import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { verifyToken } from "@/lib/auth";

function authCheck(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  return token && verifyToken(token);
}

export async function GET(request: Request) {
  if (!authCheck(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await getSupabase()
    .from("submissions")
    .select("*")
    .order("date", { ascending: false })
    .order("submitted_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  if (!authCheck(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();
  const { error } = await getSupabase().from("submissions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
