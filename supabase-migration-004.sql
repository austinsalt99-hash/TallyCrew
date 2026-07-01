-- Migration 004: Add is_verified column to job_events
-- Run this in the Supabase SQL Editor
ALTER TABLE job_events ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT true;
UPDATE job_events SET is_verified = true WHERE is_verified IS NULL;
