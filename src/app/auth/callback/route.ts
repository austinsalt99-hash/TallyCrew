import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase-server";
import { TERMS_VERSION, PRIVACY_VERSION } from "@/lib/legalVersions";

function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const invite = searchParams.get("invite");

  const fail = (error: string) =>
    NextResponse.redirect(`${origin}/register/join?error=${error}`);

  if (!code) return fail("oauth_failed");

  const supabase = await createSupabaseServer();
  const { data: sessionData, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError || !sessionData.user) return fail("oauth_failed");

  const user = sessionData.user;
  const admin = getAdminClient();

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (existingProfile) {
    return NextResponse.redirect(
      `${origin}${existingProfile.role === "admin" ? "/admin/home" : "/"}`
    );
  }

  // No profile yet — this must be a fresh worker joining via invite link.
  if (!invite) {
    await supabase.auth.signOut();
    return fail("missing_invite");
  }

  const { data: inviteRow, error: inviteError } = await admin
    .from("invite_codes")
    .select("id, company_id, is_active, used_at")
    .eq("code", invite.toUpperCase())
    .single();

  if (inviteError || !inviteRow || !inviteRow.is_active || inviteRow.used_at) {
    await supabase.auth.signOut();
    return fail("invalid_invite");
  }

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    "";

  const { error: profileError } = await admin.from("profiles").insert({
    id: user.id,
    company_id: inviteRow.company_id,
    full_name: fullName,
    role: "worker",
  });

  if (profileError) {
    console.error("Profile insert error:", profileError);
    await supabase.auth.signOut();
    return fail("signup_failed");
  }

  await admin
    .from("invite_codes")
    .update({ used_at: new Date().toISOString(), used_by: user.id })
    .eq("id", inviteRow.id);

  const acceptedAt = new Date().toISOString();
  const { error: consentError } = await admin.from("consent_log").insert([
    { user_id: user.id, document_type: "terms", document_version: TERMS_VERSION, accepted_at: acceptedAt },
    { user_id: user.id, document_type: "privacy", document_version: PRIVACY_VERSION, accepted_at: acceptedAt },
  ]);
  if (consentError) console.error("Consent log insert error:", consentError);

  return NextResponse.redirect(`${origin}/`);
}
