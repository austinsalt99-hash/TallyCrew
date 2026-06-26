-- ============================================================
-- supabase-accounts-schema.sql
-- Run this in the Supabase SQL Editor (once, in order).
-- Adds multi-tenant account support: companies, profiles,
-- invite codes, and company_id scoping on all existing tables.
--
-- DEPENDENCY ORDER:
--   1. companies table   (no function-based policies yet)
--   2. profiles table    (references companies; no function-based policies yet)
--   3. helper functions  (SELECT from profiles — profiles must exist first)
--   4. RLS policies      (call the helpers — functions must exist first)
--   5. invite_codes      (references both companies and profiles)
--   6. ALTER existing tables + new RLS on those tables
-- ============================================================

-- -------------------------------------------------------
-- 1. COMPANIES  (table only — policy added after functions)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  subscription_status TEXT        DEFAULT 'active'  -- future: 'trial', 'cancelled', 'past_due'
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- 2. PROFILES  (table only — policies added after functions)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id  UUID    NOT NULL REFERENCES companies(id),
  full_name   TEXT    NOT NULL,
  role        TEXT    NOT NULL CHECK (role IN ('admin', 'worker')),
  is_dev      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- 3. HELPER FUNCTIONS  (SECURITY DEFINER bypasses RLS on profiles)
--    profiles table must already exist before these are created.
-- -------------------------------------------------------
DROP FUNCTION IF EXISTS get_my_company_id();
DROP FUNCTION IF EXISTS get_my_role();

CREATE OR REPLACE FUNCTION get_my_company_id()
  RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS
  $$ SELECT company_id FROM profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION get_my_role()
  RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE AS
  $$ SELECT role FROM profiles WHERE id = auth.uid() $$;

-- -------------------------------------------------------
-- 4. RLS POLICIES on companies and profiles
--    Must come AFTER the helper functions above.
-- -------------------------------------------------------

-- COMPANIES: users can read only their own company
CREATE POLICY companies_read ON companies FOR SELECT
  USING (id = get_my_company_id());

-- PROFILES: read own row and all profiles in the same company
CREATE POLICY profiles_read ON profiles FOR SELECT
  USING (company_id = get_my_company_id());

-- Users can update their own profile only
CREATE POLICY profiles_update ON profiles FOR UPDATE
  USING (id = auth.uid());

-- -------------------------------------------------------
-- 5. INVITE CODES
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS invite_codes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL REFERENCES companies(id),
  code        TEXT        UNIQUE NOT NULL,   -- 8-char alphanumeric, e.g. "A3F7K2QX"
  created_by  UUID        NOT NULL REFERENCES profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  used_at     TIMESTAMPTZ,                   -- NULL = still available
  used_by     UUID        REFERENCES profiles(id),
  is_active   BOOLEAN     DEFAULT true       -- admin can revoke
);

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- Only admins in the company can read or write invite codes
CREATE POLICY invite_codes_admin_read ON invite_codes FOR SELECT
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY invite_codes_admin_insert ON invite_codes FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY invite_codes_admin_update ON invite_codes FOR UPDATE
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin');

-- -------------------------------------------------------
-- 5. ADD company_id / user_id TO EXISTING TABLES
-- -------------------------------------------------------
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id),
  ADD COLUMN IF NOT EXISTS user_id    UUID REFERENCES auth.users(id);

ALTER TABLE job_events
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

ALTER TABLE log_entry_types
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- -------------------------------------------------------
-- 6. UPDATE RLS ON EXISTING TABLES
-- -------------------------------------------------------

-- SUBMISSIONS
-- Drop old permissive policies
DROP POLICY IF EXISTS allow_insert      ON submissions;
DROP POLICY IF EXISTS allow_anon_update ON submissions;

-- Workers can insert their own submissions; admins can insert for their company
CREATE POLICY submissions_insert ON submissions FOR INSERT
  WITH CHECK (
    company_id = get_my_company_id() AND user_id = auth.uid()
  );

-- Workers can read their own; admins can read all in company
CREATE POLICY submissions_read ON submissions FOR SELECT
  USING (
    company_id = get_my_company_id() AND (
      get_my_role() = 'admin' OR user_id = auth.uid()
    )
  );

-- Workers can update their own; admins can update all in company
CREATE POLICY submissions_update ON submissions FOR UPDATE
  USING (
    company_id = get_my_company_id() AND (
      get_my_role() = 'admin' OR user_id = auth.uid()
    )
  );

-- Only admins can delete
CREATE POLICY submissions_delete ON submissions FOR DELETE
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin');

-- JOB_EVENTS
DROP POLICY IF EXISTS allow_read ON job_events;

CREATE POLICY job_events_read ON job_events FOR SELECT
  USING (company_id = get_my_company_id());

CREATE POLICY job_events_admin_write ON job_events FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY job_events_admin_update ON job_events FOR UPDATE
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY job_events_admin_delete ON job_events FOR DELETE
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin');

-- LOG_ENTRY_TYPES
DROP POLICY IF EXISTS public_read  ON log_entry_types;
DROP POLICY IF EXISTS allow_write  ON log_entry_types;

CREATE POLICY log_types_read ON log_entry_types FOR SELECT
  USING (company_id = get_my_company_id());

CREATE POLICY log_types_admin_insert ON log_entry_types FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY log_types_admin_update ON log_entry_types FOR UPDATE
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY log_types_admin_delete ON log_entry_types FOR DELETE
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin');

-- LOG_ENTRY_FIELDS (scoped via type_id -> log_entry_types)
DROP POLICY IF EXISTS public_read  ON log_entry_fields;
DROP POLICY IF EXISTS allow_write  ON log_entry_fields;

CREATE POLICY log_fields_read ON log_entry_fields FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM log_entry_types t
      WHERE t.id = log_entry_fields.type_id
        AND t.company_id = get_my_company_id()
    )
  );

CREATE POLICY log_fields_admin_write ON log_entry_fields FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM log_entry_types t
      WHERE t.id = log_entry_fields.type_id
        AND t.company_id = get_my_company_id()
    ) AND get_my_role() = 'admin'
  );

CREATE POLICY log_fields_admin_update ON log_entry_fields FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM log_entry_types t
      WHERE t.id = log_entry_fields.type_id
        AND t.company_id = get_my_company_id()
    ) AND get_my_role() = 'admin'
  );

CREATE POLICY log_fields_admin_delete ON log_entry_fields FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM log_entry_types t
      WHERE t.id = log_entry_fields.type_id
        AND t.company_id = get_my_company_id()
    ) AND get_my_role() = 'admin'
  );

-- LOG_ENTRY_FIELD_OPTIONS (scoped via field_id -> log_entry_fields -> log_entry_types)
DROP POLICY IF EXISTS public_read  ON log_entry_field_options;
DROP POLICY IF EXISTS allow_write  ON log_entry_field_options;

CREATE POLICY log_options_read ON log_entry_field_options FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM log_entry_fields f
      JOIN log_entry_types t ON t.id = f.type_id
      WHERE f.id = log_entry_field_options.field_id
        AND t.company_id = get_my_company_id()
    )
  );

CREATE POLICY log_options_admin_write ON log_entry_field_options FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM log_entry_fields f
      JOIN log_entry_types t ON t.id = f.type_id
      WHERE f.id = log_entry_field_options.field_id
        AND t.company_id = get_my_company_id()
    ) AND get_my_role() = 'admin'
  );

CREATE POLICY log_options_admin_update ON log_entry_field_options FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM log_entry_fields f
      JOIN log_entry_types t ON t.id = f.type_id
      WHERE f.id = log_entry_field_options.field_id
        AND t.company_id = get_my_company_id()
    ) AND get_my_role() = 'admin'
  );

CREATE POLICY log_options_admin_delete ON log_entry_field_options FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM log_entry_fields f
      JOIN log_entry_types t ON t.id = f.type_id
      WHERE f.id = log_entry_field_options.field_id
        AND t.company_id = get_my_company_id()
    ) AND get_my_role() = 'admin'
  );

-- INVOICES
DROP POLICY IF EXISTS public_read  ON invoices;
DROP POLICY IF EXISTS allow_write  ON invoices;

CREATE POLICY invoices_admin_read ON invoices FOR SELECT
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY invoices_admin_insert ON invoices FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY invoices_admin_update ON invoices FOR UPDATE
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY invoices_admin_delete ON invoices FOR DELETE
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin');

-- -------------------------------------------------------
-- 7. OPTIONAL: assign existing data to a company
-- -------------------------------------------------------
-- After creating your first company account, you can run the
-- following to make old submissions visible in the dashboard.
-- Replace <YOUR_COMPANY_UUID> with the UUID from the companies table.
--
-- UPDATE submissions     SET company_id = '<YOUR_COMPANY_UUID>' WHERE company_id IS NULL;
-- UPDATE job_events      SET company_id = '<YOUR_COMPANY_UUID>' WHERE company_id IS NULL;
-- UPDATE log_entry_types SET company_id = '<YOUR_COMPANY_UUID>' WHERE company_id IS NULL;
-- UPDATE invoices        SET company_id = '<YOUR_COMPANY_UUID>' WHERE company_id IS NULL;
