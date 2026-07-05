-- Migration 007: per-option pricing on dropdown field options
ALTER TABLE log_entry_field_options
  ADD COLUMN IF NOT EXISTS rate_type   TEXT CHECK (rate_type IN ('per_hour', 'per_unit')),
  ADD COLUMN IF NOT EXISTS rate_amount NUMERIC;
