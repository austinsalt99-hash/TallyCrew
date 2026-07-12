-- Migration 010: Add Stripe billing columns to companies table
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMPTZ;

-- Index for webhook lookups by Stripe customer ID
CREATE INDEX IF NOT EXISTS idx_companies_stripe_customer_id
  ON companies (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
