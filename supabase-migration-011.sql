-- Migration 011: Siri Shortcuts support
-- Stores a hashed bearer token per admin so the "Hey Siri, add to my
-- TallyCrew calendar..." shortcut can authenticate without a browser session.
-- Only the SHA-256 hash is stored; the raw token is shown once at mint time.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS siri_token_hash TEXT UNIQUE;
