-- =============================================================
-- TallyCrew — Complete Supabase Schema
-- Run this entire file in Supabase → SQL Editor to set up or
-- rebuild the database from scratch.
--
-- TABLE ORDER (dependency safe):
--   1.  companies
--   2.  profiles              (references companies, auth.users)
--   3.  Helper functions      (reference profiles — must exist first)
--   4.  RLS policies          (use helper functions — must exist first)
--   5.  invite_codes          (references companies + profiles)
--   6.  submissions           (references companies, auth.users)
--   7.  job_events            (references companies)
--   8.  log_entry_types       (references companies)
--   9.  log_entry_fields      (references log_entry_types)
--  10.  log_entry_field_options (references log_entry_fields)
--  11.  invoices              (references companies)
--  12.  announcements         (references companies, profiles)
--  13.  Storage buckets       (job photos, company banners)
-- =============================================================


-- -------------------------------------------------------------
-- 1. COMPANIES
--    One row per customer company. All data is scoped to this.
--    banner_url: optional custom dashboard banner image.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  subscription_status TEXT        DEFAULT 'active',
  banner_url          TEXT
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Toronto';

-- Pay schedule used by the admin Payroll section to compute period boundaries.
-- pay_period_anchor is the start date of a known period; only used to derive
-- weekly/biweekly boundaries (semimonthly/monthly are purely calendar-based).
ALTER TABLE companies ADD COLUMN IF NOT EXISTS pay_period_type TEXT NOT NULL DEFAULT 'biweekly'
  CHECK (pay_period_type IN ('weekly', 'biweekly', 'semimonthly', 'monthly'));
ALTER TABLE companies ADD COLUMN IF NOT EXISTS pay_period_anchor DATE NOT NULL DEFAULT '2024-01-01';


-- -------------------------------------------------------------
-- 2. PROFILES
--    One row per auth user. Links a Supabase auth user to a
--    company and assigns a role (admin or worker).
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID    NOT NULL REFERENCES companies(id),
  full_name  TEXT    NOT NULL,
  role       TEXT    NOT NULL CHECK (role IN ('admin', 'worker')),
  is_dev     BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;


-- -------------------------------------------------------------
-- 3. HELPER FUNCTIONS
--    SECURITY DEFINER so they can read profiles even when RLS
--    would otherwise block it. profiles table must exist first.
-- -------------------------------------------------------------
DROP FUNCTION IF EXISTS get_my_company_id();
DROP FUNCTION IF EXISTS get_my_role();

CREATE OR REPLACE FUNCTION get_my_company_id()
  RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS
  $$ SELECT company_id FROM profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION get_my_role()
  RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE AS
  $$ SELECT role FROM profiles WHERE id = auth.uid() $$;


-- -------------------------------------------------------------
-- 4. RLS POLICIES — companies & profiles
-- -------------------------------------------------------------

-- Companies: users see only their own company
CREATE POLICY companies_read ON companies FOR SELECT
  USING (id = get_my_company_id());

-- Admins can update their company row (e.g. banner_url)
CREATE POLICY companies_admin_update ON companies FOR UPDATE
  USING (id = get_my_company_id() AND get_my_role() = 'admin')
  WITH CHECK (id = get_my_company_id() AND get_my_role() = 'admin');

-- Profiles: users see all profiles in their company
CREATE POLICY profiles_read ON profiles FOR SELECT
  USING (company_id = get_my_company_id());

-- Users can update their own profile only, cannot change role or company_id
CREATE POLICY profiles_update ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = get_my_role()
    AND company_id = get_my_company_id()
  );


-- -------------------------------------------------------------
-- 5. INVITE CODES
--    Admins generate codes; workers use them to join a company.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invite_codes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID        NOT NULL REFERENCES companies(id),
  code       TEXT        UNIQUE NOT NULL,
  created_by UUID        NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at    TIMESTAMPTZ,
  used_by    UUID        REFERENCES profiles(id),
  is_active  BOOLEAN     DEFAULT true
);

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY invite_codes_admin_read ON invite_codes FOR SELECT
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY invite_codes_admin_insert ON invite_codes FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY invite_codes_admin_update ON invite_codes FOR UPDATE
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin');


-- -------------------------------------------------------------
-- 6. SUBMISSIONS
--    Employee timesheet submissions. billable_entries,
--    non_billable_entries, and daily_entries are JSONB arrays.
--    break_minutes: total break time deducted from the day.
-- -------------------------------------------------------------
CREATE TABLE submissions (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_at             TIMESTAMPTZ DEFAULT NOW(),
  company_id               UUID        REFERENCES companies(id),
  user_id                  UUID        REFERENCES auth.users(id),
  employee_name            TEXT        NOT NULL,
  date                     DATE        NOT NULL,
  day_start_time           TEXT,
  day_end_time             TEXT,
  billable_entries         JSONB,
  non_billable_entries     JSONB,
  daily_entries            JSONB       NOT NULL DEFAULT '[]',
  notes                    TEXT,
  total_billable_hours     DECIMAL,
  total_non_billable_hours DECIMAL,
  break_minutes            INTEGER     DEFAULT 0
);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY submissions_insert ON submissions FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND user_id = auth.uid());

CREATE POLICY submissions_read ON submissions FOR SELECT
  USING (
    company_id = get_my_company_id() AND (
      get_my_role() = 'admin' OR user_id = auth.uid()
    )
  );

CREATE POLICY submissions_update ON submissions FOR UPDATE
  USING (
    company_id = get_my_company_id() AND (
      get_my_role() = 'admin' OR user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id = get_my_company_id() AND (
      get_my_role() = 'admin' OR user_id = auth.uid()
    )
  );

CREATE POLICY submissions_delete ON submissions FOR DELETE
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin');


-- -------------------------------------------------------------
-- 7. JOB EVENTS
--    Admin-created calendar entries visible to all workers.
--    is_verified: marks the job as confirmed/verified.
-- -------------------------------------------------------------
CREATE TABLE job_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  company_id  UUID        REFERENCES companies(id),
  date        DATE        NOT NULL,
  title       TEXT        NOT NULL,
  client      TEXT,
  location    TEXT,
  description TEXT,
  start_time  TIME,
  end_time    TIME,
  assigned_to TEXT,
  is_verified BOOLEAN     DEFAULT true
);

ALTER TABLE job_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_events_read ON job_events FOR SELECT
  USING (company_id = get_my_company_id());

CREATE POLICY job_events_admin_insert ON job_events FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY job_events_admin_update ON job_events FOR UPDATE
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY job_events_admin_delete ON job_events FOR DELETE
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin');


-- -------------------------------------------------------------
-- 8. LOG ENTRY TYPES
--    Admins define custom billable entry types (e.g. "Trucking").
--    time_mode: 'job' = per-job start/end, 'none' = no times.
--    Slugs are unique per company.
-- -------------------------------------------------------------
CREATE TABLE log_entry_types (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  company_id UUID        REFERENCES companies(id),
  name       TEXT        NOT NULL,
  slug       TEXT        NOT NULL,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  is_timed   BOOLEAN     NOT NULL DEFAULT true,
  time_mode  TEXT        NOT NULL DEFAULT 'job',
  CONSTRAINT log_entry_types_company_slug_key UNIQUE (company_id, slug)
);

ALTER TABLE log_entry_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY log_types_read ON log_entry_types FOR SELECT
  USING (company_id = get_my_company_id());

CREATE POLICY log_types_admin_insert ON log_entry_types FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY log_types_admin_update ON log_entry_types FOR UPDATE
  USING  (company_id = get_my_company_id() AND get_my_role() = 'admin')
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY log_types_admin_delete ON log_entry_types FOR DELETE
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin');


-- -------------------------------------------------------------
-- 9. LOG ENTRY FIELDS
--    Fields belonging to a type (e.g. "From Location").
-- -------------------------------------------------------------
CREATE TABLE log_entry_fields (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id     UUID    NOT NULL REFERENCES log_entry_types(id) ON DELETE CASCADE,
  label       TEXT    NOT NULL,
  field_key   TEXT    NOT NULL,
  field_type  TEXT    NOT NULL CHECK (field_type IN ('dropdown', 'number', 'text')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT false,
  rate_type   TEXT    CHECK (rate_type IN ('per_hour', 'per_unit')),
  rate_amount NUMERIC
);

ALTER TABLE log_entry_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY log_fields_read ON log_entry_fields FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM log_entry_types t
      WHERE t.id = log_entry_fields.type_id
        AND t.company_id = get_my_company_id()
    )
  );

CREATE POLICY log_fields_admin_insert ON log_entry_fields FOR INSERT
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


-- -------------------------------------------------------------
-- 10. LOG ENTRY FIELD OPTIONS
--     Dropdown options for fields (e.g. "Smith Farm").
-- -------------------------------------------------------------
CREATE TABLE log_entry_field_options (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id    UUID    NOT NULL REFERENCES log_entry_fields(id) ON DELETE CASCADE,
  label       TEXT    NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  rate_type   TEXT    CHECK (rate_type IN ('per_hour', 'per_unit')),
  rate_amount NUMERIC
);

ALTER TABLE log_entry_field_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY log_options_read ON log_entry_field_options FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM log_entry_fields f
      JOIN log_entry_types t ON t.id = f.type_id
      WHERE f.id = log_entry_field_options.field_id
        AND t.company_id = get_my_company_id()
    )
  );

CREATE POLICY log_options_admin_insert ON log_entry_field_options FOR INSERT
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


-- -------------------------------------------------------------
-- 11. INVOICES
--     Admin-generated invoices. line_items is a JSONB array.
--     line_items shape: [{ description, employee, date, hours, amount }]
-- -------------------------------------------------------------
CREATE TABLE invoices (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  company_id      UUID        REFERENCES companies(id),
  invoice_number  TEXT        NOT NULL UNIQUE,
  client_name     TEXT        NOT NULL,
  date_from       DATE        NOT NULL,
  date_to         DATE        NOT NULL,
  invoice_date    DATE        NOT NULL DEFAULT CURRENT_DATE,
  company_name    TEXT,
  company_address TEXT,
  line_items      JSONB       NOT NULL DEFAULT '[]',
  total           NUMERIC     NOT NULL DEFAULT 0,
  notes           TEXT,
  status          TEXT        NOT NULL DEFAULT 'draft'
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_admin_read ON invoices FOR SELECT
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY invoices_admin_insert ON invoices FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY invoices_admin_update ON invoices FOR UPDATE
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY invoices_admin_delete ON invoices FOR DELETE
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin');


-- -------------------------------------------------------------
-- 12. ANNOUNCEMENTS
--     Admin-posted notices shown on employee and admin dashboards.
--     pinned rows appear first; sorted by created_at DESC otherwise.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS announcements (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID        NOT NULL REFERENCES companies(id),
  title      TEXT        NOT NULL,
  body       TEXT,
  pinned     BOOLEAN     NOT NULL DEFAULT false,
  created_by UUID        NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- All company members can read announcements
CREATE POLICY announcements_read ON announcements FOR SELECT
  USING (company_id = get_my_company_id());

-- Only admins can create, update, or delete announcements
CREATE POLICY announcements_admin_insert ON announcements FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY announcements_admin_update ON announcements FOR UPDATE
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin')
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY announcements_admin_delete ON announcements FOR DELETE
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin');


-- -------------------------------------------------------------
-- 13. REMINDERS
--     Admin-created timed reminders. Fires as push notifications
--     either on a recurring schedule (days_of_week + send_time) or
--     once on a specific date (one_off_date + send_time). Exactly
--     one of days_of_week / one_off_date is set per reminder; the
--     cron job deactivates a one-off reminder after it fires.
--     target_type='all' → all workers; 'specific' → target_user_ids only.
--     last_sent_date prevents duplicate sends within the same day.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reminders (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by      UUID        NOT NULL REFERENCES profiles(id),
  title           TEXT        NOT NULL,
  body            TEXT,
  target_type     TEXT        NOT NULL DEFAULT 'all' CHECK (target_type IN ('all', 'specific')),
  target_user_ids UUID[],
  send_time       TEXT        NOT NULL,
  days_of_week    INT[],
  one_off_date    DATE,
  active          BOOLEAN     NOT NULL DEFAULT TRUE,
  last_sent_date  TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Existing deployments: relax days_of_week to nullable and add one_off_date
ALTER TABLE reminders ALTER COLUMN days_of_week DROP NOT NULL;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS one_off_date DATE;

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Admins see all reminders for their company
CREATE POLICY reminders_admin_read ON reminders FOR SELECT
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin');

-- Workers see only active reminders targeted at them
CREATE POLICY reminders_worker_read ON reminders FOR SELECT
  USING (
    company_id = get_my_company_id()
    AND get_my_role() = 'worker'
    AND active = TRUE
    AND (target_type = 'all' OR auth.uid() = ANY(target_user_ids))
  );

CREATE POLICY reminders_admin_insert ON reminders FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY reminders_admin_update ON reminders FOR UPDATE
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin')
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() = 'admin');


-- -------------------------------------------------------------
-- 14. PAYROLL PERIODS
--     Tracks which pay periods an admin has marked as paid. Hours
--     and pay amounts themselves are computed on the fly from
--     submissions — this table only records the paid/unpaid state
--     for a given (company, period_start, period_end).
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_periods (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_start  DATE        NOT NULL,
  period_end    DATE        NOT NULL,
  paid_at       TIMESTAMPTZ,
  paid_by       UUID        REFERENCES profiles(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT payroll_periods_company_range_key UNIQUE (company_id, period_start, period_end)
);

ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY payroll_periods_admin_read ON payroll_periods FOR SELECT
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY payroll_periods_admin_insert ON payroll_periods FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY payroll_periods_admin_update ON payroll_periods FOR UPDATE
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin')
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY reminders_admin_delete ON reminders FOR DELETE
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin');


-- -------------------------------------------------------------
-- 15. STORAGE BUCKETS
--     job-photos:     photos attached to billable job entries
--     company-banners: custom dashboard banner images (admin upload)
--
--     NOTE: Create both buckets manually in Supabase Dashboard →
--     Storage → New bucket, with Public: ON, before using them.
--     Then run the policies below.
-- -------------------------------------------------------------

-- Job photos bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-photos', 'job-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "job_photos_read"   ON storage.objects FOR SELECT  USING     (bucket_id = 'job-photos');
CREATE POLICY "job_photos_insert" ON storage.objects FOR INSERT  WITH CHECK (bucket_id = 'job-photos' AND auth.uid() IS NOT NULL);
CREATE POLICY "job_photos_delete" ON storage.objects FOR DELETE  USING     (bucket_id = 'job-photos' AND auth.uid() IS NOT NULL);

-- Company banners bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-banners', 'company-banners', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "company_banners_read"   ON storage.objects FOR SELECT  USING     (bucket_id = 'company-banners');
CREATE POLICY "company_banners_insert" ON storage.objects FOR INSERT  WITH CHECK (bucket_id = 'company-banners' AND auth.uid() IS NOT NULL);
CREATE POLICY "company_banners_delete" ON storage.objects FOR DELETE  USING     (bucket_id = 'company-banners' AND auth.uid() IS NOT NULL);


-- -------------------------------------------------------------
-- 16. ONGOING JOBS
--     A reusable "parent" job (e.g. a long-running project) that
--     job_events can link to via job_events.ongoing_job_id, so
--     scheduling another day for the same project doesn't require
--     re-entering client/location/description, and invoicing can
--     pull hours across every day logged against the project
--     regardless of which specific calendar entry an employee's
--     timesheet was linked to.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ongoing_jobs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  client      TEXT,
  location    TEXT,
  description TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ongoing_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY ongoing_jobs_admin_read ON ongoing_jobs FOR SELECT
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY ongoing_jobs_admin_insert ON ongoing_jobs FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY ongoing_jobs_admin_update ON ongoing_jobs FOR UPDATE
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin')
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY ongoing_jobs_admin_delete ON ongoing_jobs FOR DELETE
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin');

ALTER TABLE job_events ADD COLUMN IF NOT EXISTS ongoing_job_id UUID REFERENCES ongoing_jobs(id) ON DELETE SET NULL;
