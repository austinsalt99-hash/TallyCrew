-- Run this in your Supabase project → SQL Editor
-- Adds "is_timed" column to log_entry_types (run AFTER supabase-log-config-schema.sql)

ALTER TABLE log_entry_types ADD COLUMN IF NOT EXISTS is_timed BOOLEAN NOT NULL DEFAULT true;
