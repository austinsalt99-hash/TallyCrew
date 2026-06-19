-- Run this in your Supabase project → SQL Editor

CREATE TABLE submissions (
  id                       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submitted_at             TIMESTAMPTZ DEFAULT NOW(),
  employee_name            TEXT NOT NULL,
  date                     DATE NOT NULL,
  billable_entries         JSONB,
  non_billable_entries     JSONB,
  notes                    TEXT,
  total_billable_hours     DECIMAL,
  total_non_billable_hours DECIMAL
);

-- Enable Row Level Security
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Allow inserts (employees submitting timesheets) but no public reads
CREATE POLICY "allow_insert" ON submissions FOR INSERT WITH CHECK (true);
