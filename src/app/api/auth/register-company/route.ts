import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: NextRequest) {
  const { companyName, fullName, email, password } = await req.json();

  if (!companyName || !fullName || !email || !password) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }

  const admin = getAdminClient();

  // 1. Create the company
  const { data: company, error: companyError } = await admin
    .from("companies")
    .insert({ name: companyName })
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

  return NextResponse.json({ ok: true });
}
