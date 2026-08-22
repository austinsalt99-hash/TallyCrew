import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import { getSubscriptionLabel } from "@/lib/subscription";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin, syncSubscriptionFromStripe } from "@/lib/subscriptionSync";
import { redirect } from "next/navigation";
import ConfirmedClient from "./ConfirmedClient";

export default async function BillingConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);

  if (!user || !profile || profile.role !== "admin") {
    redirect("/login");
  }

  const { session_id: sessionId } = await searchParams;

  // Reconcile immediately rather than waiting on the async Stripe webhook,
  // so the confirmation reflects the subscription the moment it lands here.
  if (sessionId && profile.company_id) {
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
    .select("name, subscription_status, subscription_period_end")
    .eq("id", profile.company_id)
    .single();

  const nextBillingDate = company?.subscription_period_end
    ? new Date(company.subscription_period_end).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const label = getSubscriptionLabel(
    company?.subscription_status ?? null,
    company?.subscription_period_end ?? null,
    null
  );

  return (
    <ConfirmedClient
      companyName={company?.name ?? ""}
      statusLabel={label}
      isTrialing={company?.subscription_status === "trialing"}
      nextBillingDate={nextBillingDate}
    />
  );
}
