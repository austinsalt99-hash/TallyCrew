const GRACE_PERIOD_DAYS = 7;

export function isSubscriptionActive(
  status: string | null,
  periodEnd: string | null
): boolean {
  if (status === "active" || status === "trialing") return true;
  if (status === "past_due" && periodEnd) {
    const graceCutoff = new Date(periodEnd);
    graceCutoff.setDate(graceCutoff.getDate() + GRACE_PERIOD_DAYS);
    return new Date() < graceCutoff;
  }
  return false;
}

export function getSubscriptionLabel(
  status: string | null,
  periodEnd: string | null,
  interval: string | null
): string {
  if (status === "trialing" && periodEnd) {
    const daysLeft = Math.ceil(
      (new Date(periodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return `Free trial — ${daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : "ending today"}`;
  }
  if (status === "active") {
    return interval === "year" ? "Active — Annual plan" : "Active — Monthly plan";
  }
  if (status === "past_due") return "Payment failed — please update billing";
  if (status === "canceled") return "Canceled";
  if (status === "unpaid") return "Unpaid — subscription suspended";
  return "No active subscription";
}
