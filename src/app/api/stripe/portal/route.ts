import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);

  if (!user || !profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: company } = await supabase
    .from("companies")
    .select("stripe_customer_id")
    .eq("id", profile.company_id)
    .single();

  if (!company?.stripe_customer_id) {
    return NextResponse.json({ error: "No billing account found" }, { status: 400 });
  }

  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const portalSession = await getStripe().billingPortal.sessions.create({
      customer: company.stripe_customer_id,
      return_url: `${origin}/admin/billing`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    console.error("Stripe portal session creation failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not open billing portal." },
      { status: 500 }
    );
  }
}
