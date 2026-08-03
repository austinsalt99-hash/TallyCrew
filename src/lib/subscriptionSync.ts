import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

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
  const update = {
    stripe_customer_id: subscription.customer as string,
    stripe_subscription_id: subscription.id,
    subscription_status: subscription.status,
    subscription_period_end: periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : null,
  };

  if (companyId) {
    await admin.from("companies").update(update).eq("id", companyId);
  } else {
    await admin
      .from("companies")
      .update(update)
      .eq("stripe_customer_id", subscription.customer as string);
  }
}
