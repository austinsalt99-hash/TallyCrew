import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// Mints a new Siri Shortcuts token for the logged-in admin, replacing any
// existing one. The raw token is only ever returned here — the DB keeps a hash.
export async function POST() {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const token = randomBytes(24).toString("hex");

  const { error } = await supabase
    .from("profiles")
    .update({ siri_token_hash: hashToken(token) })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ token });
}

export async function DELETE() {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabase
    .from("profiles")
    .update({ siri_token_hash: null })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
