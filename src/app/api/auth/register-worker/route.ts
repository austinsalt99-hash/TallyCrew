import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { TERMS_VERSION, PRIVACY_VERSION } from "@/lib/legalVersions";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(`register-worker:${getClientIp(req)}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many signup attempts. Please try again later." }, { status: 429 });
  }

  const { code, fullName, email, password, agreedToTerms } = await req.json();

  if (!code || !fullName || !email || !password) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }
  if (!agreedToTerms) {
    return NextResponse.json(
      { error: "You must agree to the Terms of Service and Privacy Policy." },
      { status: 400 }
    );
  }

  const admin = getAdminClient();

  // 1. Validate the invite code
  const { data: invite, error: inviteError } = await admin
    .from("invite_codes")
    .select("id, company_id, is_active, used_at")
    .eq("code", code.toUpperCase())
    .single();

  if (inviteError || !invite) {
    return NextResponse.json({ error: "Invalid invite code." }, { status: 400 });
  }
  if (!invite.is_active || invite.used_at) {
    return NextResponse.json(
      { error: "This invite code has already been used or was revoked." },
      { status: 400 }
    );
  }

  // 2. Create the auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: authError?.message ?? "Failed to create account." },
      { status: 400 }
    );
  }

  // 3. Create the worker profile
  const { error: profileError } = await admin.from("profiles").insert({
    id: authData.user.id,
    company_id: invite.company_id,
    full_name: fullName,
    role: "worker",
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id);
    console.error("Profile insert error:", profileError);
    return NextResponse.json({ error: "Account setup failed. Please try again." }, { status: 500 });
  }

  // 4. Mark invite code as used
  await admin
    .from("invite_codes")
    .update({ used_at: new Date().toISOString(), used_by: authData.user.id })
    .eq("id", invite.id);

  // 5. Record consent — append-only, tied to the exact document version shown at signup.
  // Not fatal to account creation if this fails; just logged for follow-up.
  const acceptedAt = new Date().toISOString();
  const { error: consentError } = await admin.from("consent_log").insert([
    { user_id: authData.user.id, document_type: "terms", document_version: TERMS_VERSION, accepted_at: acceptedAt },
    { user_id: authData.user.id, document_type: "privacy", document_version: PRIVACY_VERSION, accepted_at: acceptedAt },
  ]);
  if (consentError) console.error("Consent log insert error:", consentError);

  // Session is established client-side via signInWithPassword after this returns OK
  return NextResponse.json({ ok: true });
}
