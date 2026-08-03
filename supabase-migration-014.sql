-- Migration 014: Quotes
-- A tentative job that isn't confirmed yet. Lives in its own table so it
-- never shows up on the calendar grid / Crew Board / Workload until an
-- admin explicitly converts it into a real job_events row.
CREATE TABLE IF NOT EXISTS quotes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title            TEXT        NOT NULL,
  client           TEXT,
  location         TEXT,
  description      TEXT,
  estimated_price  NUMERIC,
  target_date      DATE,
  valid_until      DATE,
  status           TEXT        NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','accepted','declined','converted')),
  converted_job_id UUID REFERENCES job_events(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY quotes_admin_read ON quotes FOR SELECT
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY quotes_admin_insert ON quotes FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY quotes_admin_update ON quotes FOR UPDATE
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin')
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() = 'admin');

CREATE POLICY quotes_admin_delete ON quotes FOR DELETE
  USING (company_id = get_my_company_id() AND get_my_role() = 'admin');
