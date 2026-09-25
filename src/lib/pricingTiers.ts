// Single source of truth for the 3 worker-count-based tiers, imported by the
// marketing pricing page, the registration tier picker, the checkout route,
// and the webhook/change-plan tier resolution. Keeping one file means the
// advertised price and the price Stripe actually charges can never drift.
//
// Legacy accounts (a handful of test/promo-code accounts on the old flat
// STRIPE_MONTHLY_PRICE_ID / STRIPE_ANNUAL_PRICE_ID prices) are untouched by
// this module — those env vars aren't referenced here at all.

export type PlanTierKey = "solo" | "team" | "business";

export interface PlanTier {
  key: PlanTierKey;
  name: string;
  /** Max workers, not counting the admin/boss. */
  workerLimit: number;
  /** Must match the Stripe Price you create for this tier — see the setup walkthrough. */
  priceMonthly: number;
  /** Env var holding this tier's Stripe Price ID. */
  priceEnvVar: string;
}

export const PLAN_TIER_ORDER: PlanTierKey[] = ["solo", "team", "business"];

export const PLAN_TIERS: Record<PlanTierKey, PlanTier> = {
  solo: {
    key: "solo",
    name: "Solo",
    workerLimit: 1,
    priceMonthly: 35,
    priceEnvVar: "STRIPE_TIER_SOLO_PRICE_ID",
  },
  team: {
    key: "team",
    name: "Team",
    workerLimit: 5,
    priceMonthly: 55,
    priceEnvVar: "STRIPE_TIER_TEAM_PRICE_ID",
  },
  business: {
    key: "business",
    name: "Business",
    workerLimit: 15,
    priceMonthly: 95,
    priceEnvVar: "STRIPE_TIER_BUSINESS_PRICE_ID",
  },
};

export function isPlanTierKey(v: unknown): v is PlanTierKey {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(PLAN_TIERS, v);
}

export function getTierPriceId(tier: PlanTierKey): string {
  const id = process.env[PLAN_TIERS[tier].priceEnvVar];
  if (!id) throw new Error(`${PLAN_TIERS[tier].priceEnvVar} is not set`);
  return id;
}

// Resolves a Stripe Price ID back to one of our 3 tiers. Any price that
// isn't one of ours — including the legacy monthly/annual prices — resolves
// to null, so callers leave plan_tier/worker_limit alone for those.
export function resolveTierFromPriceId(priceId: string | null | undefined): PlanTierKey | null {
  if (!priceId) return null;
  return PLAN_TIER_ORDER.find((k) => process.env[PLAN_TIERS[k].priceEnvVar] === priceId) ?? null;
}
