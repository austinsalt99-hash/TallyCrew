-- Migration 003: add break_minutes to submissions
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS break_minutes INTEGER DEFAULT 0;
