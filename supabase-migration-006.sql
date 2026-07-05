-- Migration 006: Pricing on log entry types
-- Run this in the Supabase SQL Editor
-- If you already ran a previous version of this migration, run only the lines that add new columns.

ALTER TABLE log_entry_types
  ADD COLUMN IF NOT EXISTS is_priced   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rate_type   TEXT CHECK (rate_type IN ('per_hour', 'per_unit')),
  ADD COLUMN IF NOT EXISTS rate_amount NUMERIC;
