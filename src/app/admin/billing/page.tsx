import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import { getSubscriptionLabel } from "@/lib/subscription";
import { getStripe } from "@/lib/stripe";
import { redirect } from "next/navigation";
import AdminBillingClient from "./AdminBillingClient";

export default async function AdminBillingPage() {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);

  if (!user || !profile || profile.role !== "admin") {
    redirect("/login");
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
    />
  );
}
