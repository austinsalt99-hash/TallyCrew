-- Migration 012: Append-only consent log for Terms of Service / Privacy Policy acceptance
-- One row per document per acceptance, tied to the exact version shown at accept time,
-- so we can prove which text a user agreed to even after the legal pages are edited later.
CREATE TABLE IF NOT EXISTS consent_log (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type    TEXT        NOT NULL CHECK (document_type IN ('terms', 'privacy')),
  document_version TEXT        NOT NULL,
  accepted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_log_user_id ON consent_log (user_id);

ALTER TABLE consent_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own consent history. All writes go through the service role
-- (register-company / register-worker API routes) — no insert/update/delete policy
-- is defined, so the log cannot be altered from the client. Append-only by design.
CREATE POLICY consent_log_read ON consent_log FOR SELECT
  USING (user_id = auth.uid());
