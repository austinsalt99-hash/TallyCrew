-- Migration 009: worker hourly wages + invoice column config

-- Add hourly_wage to profiles (admins can set a per-worker billing rate)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hourly_wage NUMERIC(10,2);

-- Allow admins to update profiles within their company (e.g. setting hourly_wage)
-- The existing profiles_update policy only allows self-update; this adds admin capability.
CREATE POLICY profiles_admin_update ON profiles FOR UPDATE
  USING  (company_id = get_my_company_id() AND get_my_role() = 'admin')
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() = 'admin');

-- Add column_config to invoices so admins can choose which columns appear
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS column_config JSONB NOT NULL DEFAULT '[]';
