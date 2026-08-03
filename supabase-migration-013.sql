-- Migration 013: Per-company configurable morning digest send time
-- morning_digest_time: local HH:MM the digest should fire at, in the company's timezone.
-- morning_digest_last_sent_date: prevents scheduling the same day's digest twice.
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS morning_digest_time TEXT NOT NULL DEFAULT '07:00',
  ADD COLUMN IF NOT EXISTS morning_digest_last_sent_date TEXT;
