-- Migration 008: per-field pricing on number fields
ALTER TABLE log_entry_fields
  ADD COLUMN IF NOT EXISTS rate_type   TEXT CHECK (rate_type IN ('per_hour', 'per_unit')),
  ADD COLUMN IF NOT EXISTS rate_amount NUMERIC;
