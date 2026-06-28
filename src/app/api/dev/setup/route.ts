import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// One-time endpoint to create the dev account.
// Protected by DEV_SETUP_SECRET — call it once then leave it.
// GET /api/dev/setup?secret=<DEV_SETUP_SECRET>
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.DEV_SETUP_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const email = process.env.DEV_EMAIL;
  const password = process.env.DEV_PASSWORD;
  if (!email || !password) {
    return NextResponse.json({ error: "DEV_EMAIL or DEV_PASSWORD not set in .env.local" }, { status: 500 });
  }

  const admin = getAdminClient();

  // Check if dev user already exists
  const { data: existingUsers } = await admin.auth.admin.listUsers();
  const existing = existingUsers?.users.find((u) => u.email === email);
  if (existing) {
    return NextResponse.json({ ok: true, status: "already exists", email });
  }

  // 1. Create a dedicated dev/test company
  const { data: company, error: companyError } = await admin
    .from("companies")
    .insert({ name: "TallyCrew Dev & Testing" })
    .select("id")
    .single();

  if (companyError || !company) {
    return NextResponse.json({ error: "Failed to create dev company" }, { status: 500 });
  }

  // 2. Create the auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Austin (Dev)" },
  });

  if (authError || !authData.user) {
    await admin.from("companies").delete().eq("id", company.id);
    return NextResponse.json({ error: authError?.message ?? "Failed to create user" }, { status: 500 });
  }

  // 3. Create the dev profile (admin role + is_dev flag)
  const { error: profileError } = await admin.from("profiles").insert({
    id: authData.user.id,
    company_id: company.id,
    full_name: "Austin (Dev)",
    role: "admin",
    is_dev: true,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id);
    await admin.from("companies").delete().eq("id", company.id);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: "created", email });
}
