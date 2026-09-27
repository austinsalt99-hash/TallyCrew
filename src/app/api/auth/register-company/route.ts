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

// Finds a previous signup under this email that never finished Stripe
// checkout (company still "pending"), so it can be cleared out and the
// email freed up for a fresh registration attempt. Returns null — leaving
// the existing account untouched — for a real, already-active account.
async function findStalePendingSignup(
  admin: ReturnType<typeof getAdminClient>,
  email: string
): Promise<{ userId: string; companyId: string } | null> {
  const { data } = await admin.auth.admin.listUsers({ perPage: 10000 });
  const existing = data?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!existing) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("company_id")
    .eq("id", existing.id)
    .single();
  if (!profile) return null;

  const { data: company } = await admin
    .from("companies")
    .select("id, subscription_status")
    .eq("id", profile.company_id)
    .single();
  if (!company || company.subscription_status !== "pending") return null;

  return { userId: existing.id, companyId: company.id };
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
  // /admin until they complete Stripe checkout (see proxy.ts).
  const { data: company, error: companyError } = await admin
    .from("companies")
    .insert({ name: companyName, subscription_status: "pending" })
    .select("id")
    .single();

  if (companyError || !company) {
    console.error("Company insert error:", companyError);
    return NextResponse.json({ error: "Failed to create company." }, { status: 500 });
  }

  // 2. Create the auth user (skip email confirmation for this internal app).
  // If the email is already taken by a PREVIOUS signup attempt that never
  // finished Stripe checkout (subscription_status still "pending" — i.e.
  // they backed out and are now retrying with the same email), clear out
  // that stale, never-activated company + login and retry once. A real,
  // already-paying account with that email is left untouched and returns
  // the normal "already registered" error.
  let { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  const isDuplicateEmail =
    authError?.code === "email_exists" ||
    /already.*registered|already.*exists/i.test(authError?.message ?? "");

  if (isDuplicateEmail) {
    const stale = await findStalePendingSignup(admin, email);
    if (stale) {
      await admin.from("companies").delete().eq("id", stale.companyId);
      await admin.auth.admin.deleteUser(stale.userId); // cascades the old profile row

      ({ data: authData, error: authError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      }));
    }
  }

  if (authError || !authData?.user) {
    await admin.from("companies").delete().eq("id", company.id);
    return NextResponse.json(
      {
        error: isDuplicateEmail
          ? "An account with this email already exists. Please log in instead."
          : authError?.message ?? "Failed to create account.",
      },
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
