import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import { getSubscriptionLabel } from "@/lib/subscription";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin, syncSubscriptionFromStripe } from "@/lib/subscriptionSync";
import { redirect } from "next/navigation";
import AdminBillingClient from "./AdminBillingClient";

export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; session_id?: string }>;
}) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);

  if (!user || !profile || profile.role !== "admin") {
    redirect("/login");
  }

  const { success, session_id: sessionId } = await searchParams;

  // Don't wait on the async Stripe webhook to unlock the account — reconcile
  // the checkout result directly the moment the user lands back here.
  if (success === "1" && sessionId && profile.company_id) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId, {
        expand: ["subscription"],
      });
      if (session.subscription && typeof session.subscription !== "string") {
        await syncSubscriptionFromStripe(getSupabaseAdmin(), session.subscription, profile.company_id);
      }
    } catch (err) {
      console.error("Checkout session reconciliation failed:", err);
    }
  }

  const { data: company } = await supabase
    .from("companies")
    .select("name, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_period_end")
    .eq("id", profile.company_id)
    .single();

  // Fetch subscription interval from Stripe only when we have an active subscription
  let interval: string | null = null;
  if (company?.stripe_subscription_id) {
    try {
      const sub = await getStripe().subscriptions.retrieve(company.stripe_subscription_id, {
        expand: ["items.data.price"],
      });
      const price = sub.items.data[0]?.price;
      interval = price?.recurring?.interval ?? null;
    } catch {
      // Non-critical — label will just omit interval
    }
  }

  const showSuccess = success === "1";

  const label = getSubscriptionLabel(
    company?.subscription_status ?? null,
    company?.subscription_period_end ?? null,
    interval
  );

  const nextBillingDate = company?.subscription_period_end
    ? new Date(company.subscription_period_end).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <AdminBillingClient
      companyName={company?.name ?? ""}
      statusLabel={label}
      subscriptionStatus={company?.subscription_status ?? null}
      nextBillingDate={nextBillingDate}
      hasStripeCustomer={!!company?.stripe_customer_id}
      showSuccess={showSuccess}
    />
  );
}
