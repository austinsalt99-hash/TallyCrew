import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { PLAN_TIERS, resolveTierFromPriceId } from "@/lib/pricingTiers";

export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function syncSubscriptionFromStripe(
  admin: ReturnType<typeof getSupabaseAdmin>,
  subscription: Stripe.Subscription,
  companyId?: string
) {
  // In Stripe v22, current_period_end moved from Subscription to SubscriptionItem
  const periodEnd = subscription.items.data[0]?.current_period_end;
  const price = subscription.items.data[0]?.price;
  const priceId = typeof price === "string" ? price : price?.id;
  const tier = resolveTierFromPriceId(priceId);

  const update: Record<string, unknown> = {
    stripe_customer_id: subscription.customer as string,
    stripe_subscription_id: subscription.id,
    subscription_status: subscription.status,
    subscription_period_end: periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : null,
  };

  // Only touch these when the price resolves to one of our new tiers — a
  // legacy STRIPE_MONTHLY/ANNUAL price (or any unrecognized price) resolves
  // to null and plan_tier/worker_limit/stripe_price_id are left alone,
  // which is what keeps existing promo-code accounts untouched.
  if (tier) {
    update.plan_tier = tier;
    update.worker_limit = PLAN_TIERS[tier].workerLimit;
    update.stripe_price_id = priceId ?? null;
  }

  if (companyId) {
    await admin.from("companies").update(update).eq("id", companyId);
  } else {
    await admin
      .from("companies")
      .update(update)
      .eq("stripe_customer_id", subscription.customer as string);
  }
}
