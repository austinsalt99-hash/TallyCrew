-- =============================================================
-- TallyCrew Hour Log — Full Supabase Schema
-- Run this entire file in Supabase → SQL Editor to set up or
-- rebuild the database from scratch.
-- =============================================================


-- -------------------------------------------------------------
-- 1. SUBMISSIONS
--    Employee timesheet submissions. billable_entries and
--    non_billable_entries are JSONB arrays.
-- -------------------------------------------------------------

CREATE TABLE submissions (
  id                       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submitted_at             TIMESTAMPTZ DEFAULT NOW(),
  employee_name            TEXT NOT NULL,
  date                     DATE NOT NULL,
  billable_entries         JSONB,
  non_billable_entries     JSONB,
  notes                    TEXT,
  total_billable_hours     DECIMAL,
  total_non_billable_hours DECIMAL,
  day_start_time           TEXT,
  day_end_time             TEXT
);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Employees can submit (insert) timesheets
CREATE POLICY "allow_insert" ON submissions FOR INSERT WITH CHECK (true);

-- Employees can update their own submission (gated by UUID knowledge in practice)
CREATE POLICY "allow_anon_update" ON submissions FOR UPDATE TO anon USING (true) WITH CHECK (true);


-- -------------------------------------------------------------
-- 2. JOB EVENTS
--    Admin-created calendar entries visible to all employees.
-- -------------------------------------------------------------

CREATE TABLE job_events (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  date        DATE NOT NULL,
  title       TEXT NOT NULL,
  client      TEXT,
  location    TEXT,
  description TEXT,
  start_time  TIME,
  end_time    TIME,
  assigned_to TEXT
);

ALTER TABLE job_events ENABLE ROW LEVEL SECURITY;

-- Anyone can read events (employees viewing the schedule)
CREATE POLICY "allow_read" ON job_events FOR SELECT USING (true);


-- -------------------------------------------------------------
-- 3. LOG ENTRY TYPES & FIELDS
--    Admins define custom billable entry types (e.g. "Trucking")
--    with configurable fields and dropdown options.
-- -------------------------------------------------------------

CREATE TABLE log_entry_types (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  is_timed   BOOLEAN NOT NULL DEFAULT true
);

-- Fields belonging to a type (e.g. "From Location", "Number of Loads")
CREATE TABLE log_entry_fields (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type_id     UUID NOT NULL REFERENCES log_entry_types(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  field_key   TEXT NOT NULL,
  field_type  TEXT NOT NULL CHECK (field_type IN ('dropdown', 'number', 'text')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT false
);

-- Selectable options for dropdown fields (e.g. "Smith Farm", "Highway 9 Pit")
CREATE TABLE log_entry_field_options (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  field_id   UUID NOT NULL REFERENCES log_entry_fields(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE log_entry_types         ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_entry_fields        ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_entry_field_options ENABLE ROW LEVEL SECURITY;

-- Employees read config to render the form; writes are gated by JWT at the API level
CREATE POLICY "public_read" ON log_entry_types         FOR SELECT USING (true);
CREATE POLICY "allow_write" ON log_entry_types         FOR ALL    USING (true) WITH CHECK (true);

CREATE POLICY "public_read" ON log_entry_fields        FOR SELECT USING (true);
CREATE POLICY "allow_write" ON log_entry_fields        FOR ALL    USING (true) WITH CHECK (true);

CREATE POLICY "public_read" ON log_entry_field_options FOR SELECT USING (true);
CREATE POLICY "allow_write" ON log_entry_field_options FOR ALL    USING (true) WITH CHECK (true);


-- -------------------------------------------------------------
-- 4. INVOICES
--    Admin-generated invoices. line_items is a JSONB array.
--    line_items element shape:
--    { "description": "...", "employee": "...", "date": "2026-06-15", "hours": 4.5, "amount": 450 }
-- -------------------------------------------------------------

CREATE TABLE invoices (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  invoice_number  TEXT NOT NULL UNIQUE,
  client_name     TEXT NOT NULL,
  date_from       DATE NOT NULL,
  date_to         DATE NOT NULL,
  invoice_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  company_name    TEXT,
  company_address TEXT,
  line_items      JSONB NOT NULL DEFAULT '[]',
  total           NUMERIC NOT NULL DEFAULT 0,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'draft'
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read" ON invoices FOR SELECT USING (true);
CREATE POLICY "allow_write" ON invoices FOR ALL    USING (true) WITH CHECK (true);


-- -------------------------------------------------------------
-- 5. JOB PHOTOS (Supabase Storage)
--    Public bucket for photos attached to billable job entries.
--    Photo URLs are stored in billable_entries JSONB as
--    { "photos": ["https://..."] }.
-- -------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('job-photos', 'job-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "job_photos_read"   ON storage.objects FOR SELECT USING (bucket_id = 'job-photos');
CREATE POLICY "job_photos_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'job-photos');
CREATE POLICY "job_photos_delete" ON storage.objects FOR DELETE USING (bucket_id = 'job-photos');
