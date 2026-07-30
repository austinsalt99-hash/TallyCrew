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

  const { plan } = await req.json();
  const priceId =
    plan === "annual"
      ? process.env.STRIPE_ANNUAL_PRICE_ID
      : plan === "monthly"
      ? process.env.STRIPE_MONTHLY_PRICE_ID
      : null;

  if (!priceId) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const { data: company } = await supabase
    .from("companies")
    .select("stripe_customer_id")
    .eq("id", profile.company_id)
    .single();

  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      ...(company?.stripe_customer_id
        ? { customer: company.stripe_customer_id }
        : { customer_email: user.email }),
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: { company_id: profile.company_id },
      },
      allow_promotion_codes: true,
      metadata: { company_id: profile.company_id },
      success_url: `${origin}/admin/billing?success=1`,
      cancel_url: `${origin}/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout session creation failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not start checkout." },
      { status: 500 }
    );
  }
}
