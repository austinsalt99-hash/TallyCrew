import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin, syncSubscriptionFromStripe } from "@/lib/subscriptionSync";
import { isPlanTierKey, getTierPriceId, PLAN_TIERS } from "@/lib/pricingTiers";

// Lets an admin switch their company between the 3 new tiers. Blocks the
// switch if the target tier's worker limit is below how many seats
// (active workers + pending invite codes) are currently occupied — the
// admin has to remove workers or revoke invites first. Only works for
// companies already on the new tier system; legacy/grandfathered accounts
// (on the old flat-price plans) get a "contact support" message instead of
// a self-serve path onto the new tiers, so their old prices stay untouched.
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);

  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { tier } = await req.json();
  if (!isPlanTierKey(tier)) {
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  }

  const { data: company } = await supabase
    .from("companies")
    .select("plan_tier, stripe_subscription_id")
    .eq("id", profile.company_id)
    .single();

  if (!company?.plan_tier || !company.stripe_subscription_id) {
    return NextResponse.json(
      { error: "Your account isn't on the self-serve plan system yet. Contact support to change your plan." },
      { status: 400 }
    );
  }

  if (company.plan_tier === tier) {
    return NextResponse.json({ error: "You're already on this plan." }, { status: 400 });
  }

  const newLimit = PLAN_TIERS[tier].workerLimit;

  const { count: activeWorkers } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("company_id", profile.company_id)
    .eq("role", "worker")
    .eq("is_removed", false);

  const { count: pendingCodes } = await supabase
    .from("invite_codes")
    .select("id", { count: "exact", head: true })
    .eq("company_id", profile.company_id)
    .eq("is_active", true)
    .is("used_at", null);

  const occupied = (activeWorkers ?? 0) + (pendingCodes ?? 0);

  if (occupied > newLimit) {
    return NextResponse.json(
      {
        error: `You have ${occupied} active workers/pending invites, but the ${PLAN_TIERS[tier].name} plan only supports ${newLimit}. Remove workers or revoke pending invites first.`,
      },
      { status: 400 }
    );
  }

  try {
    const sub = await getStripe().subscriptions.retrieve(company.stripe_subscription_id, {
      expand: ["items.data.price"],
    });
    const updated = await getStripe().subscriptions.update(company.stripe_subscription_id, {
      items: [{ id: sub.items.data[0].id, price: getTierPriceId(tier) }],
      proration_behavior: "create_prorations",
      metadata: { ...sub.metadata, plan_tier: tier },
    });

    // Reconcile immediately rather than waiting on the webhook, matching the
    // existing pattern in admin/billing/confirmed/page.tsx.
    await syncSubscriptionFromStripe(getSupabaseAdmin(), updated, profile.company_id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Plan change failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not change plan." },
      { status: 500 }
    );
  }
}
