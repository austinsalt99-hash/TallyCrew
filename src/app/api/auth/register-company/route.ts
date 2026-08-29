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
  if (!checkRateLimit(`register-company:${getClientIp(req)}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many signup attempts. Please try again later." }, { status: 429 });
  }

  const { companyName, fullName, email, password, agreedToTerms } = await req.json();

  if (!companyName || !fullName || !email || !password) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (!agreedToTerms) {
    return NextResponse.json(
      { error: "You must agree to the Terms of Service and Privacy Policy." },
      { status: 400 }
    );
  }

  const admin = getAdminClient();

  // 1. Create the company. New companies start "pending" and are gated out of
  // /admin until they complete Stripe checkout (see middleware.ts).
  const { data: company, error: companyError } = await admin
    .from("companies")
    .insert({ name: companyName, subscription_status: "pending" })
    .select("id")
    .single();

  if (companyError || !company) {
    console.error("Company insert error:", companyError);
    return NextResponse.json({ error: "Failed to create company." }, { status: 500 });
  }

  // 2. Create the auth user (skip email confirmation for this internal app)
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (authError || !authData.user) {
    await admin.from("companies").delete().eq("id", company.id);
    return NextResponse.json(
      { error: authError?.message ?? "Failed to create account." },
      { status: 400 }
    );
  }

  // 3. Create the admin profile
  const { error: profileError } = await admin.from("profiles").insert({
    id: authData.user.id,
    company_id: company.id,
    full_name: fullName,
    role: "admin",
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id);
    await admin.from("companies").delete().eq("id", company.id);
    console.error("Profile insert error:", profileError);
    return NextResponse.json({ error: "Account setup failed. Please try again." }, { status: 500 });
  }

  // 4. Record consent — append-only, tied to the exact document version shown at signup.
  // Not fatal to account creation if this fails; just logged for follow-up.
  const acceptedAt = new Date().toISOString();
  const { error: consentError } = await admin.from("consent_log").insert([
    { user_id: authData.user.id, document_type: "terms", document_version: TERMS_VERSION, accepted_at: acceptedAt },
    { user_id: authData.user.id, document_type: "privacy", document_version: PRIVACY_VERSION, accepted_at: acceptedAt },
  ]);
  if (consentError) console.error("Consent log insert error:", consentError);

  return NextResponse.json({ ok: true });
}
