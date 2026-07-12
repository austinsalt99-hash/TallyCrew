import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function syncSubscription(
  admin: ReturnType<typeof getAdminClient>,
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

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = getAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription" || !session.subscription) break;

      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string
      );
      const companyId = session.metadata?.company_id;
      await syncSubscription(admin, subscription, companyId);
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscription(admin, subscription);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await admin
        .from("companies")
        .update({ subscription_status: "canceled" })
        .eq("stripe_customer_id", subscription.customer as string);
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      // In Stripe v22, subscription reference moved to invoice.parent.subscription_details.subscription
      const subscriptionId =
        invoice.parent?.type === "subscription_details"
          ? (invoice.parent.subscription_details?.subscription as string | undefined)
          : undefined;
      if (!subscriptionId) break;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await syncSubscription(admin, subscription);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      if (!invoice.customer) break;
      await admin
        .from("companies")
        .update({ subscription_status: "past_due" })
        .eq("stripe_customer_id", invoice.customer as string);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
