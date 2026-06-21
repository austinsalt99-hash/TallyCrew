-- Run this in your Supabase project → SQL Editor
-- Adds the invoices table for the admin invoice generation feature

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

-- line_items JSONB array shape (one element):
-- { "description": "...", "employee": "...", "date": "2026-06-15", "hours": 4.5, "amount": 450 }

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON invoices FOR SELECT USING (true);
CREATE POLICY "allow_write" ON invoices FOR ALL USING (true) WITH CHECK (true);
