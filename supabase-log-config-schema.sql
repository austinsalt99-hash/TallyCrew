-- Run this in your Supabase project → SQL Editor
-- Adds admin-configurable log entry type tables

-- Custom log entry types (e.g. "Trucking")
CREATE TABLE log_entry_types (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT true
);

-- Fields belonging to a type (e.g. "From Location", "Number of Loads")
CREATE TABLE log_entry_fields (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type_id     UUID NOT NULL REFERENCES log_entry_types(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  field_key   TEXT NOT NULL,
  field_type  TEXT NOT NULL CHECK (field_type IN ('dropdown', 'number', 'text')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT false
);

-- Selectable options for dropdown-type fields (e.g. "Smith Farm", "Highway 9 Pit")
CREATE TABLE log_entry_field_options (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  field_id   UUID NOT NULL REFERENCES log_entry_fields(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- RLS: employees can read the config to render their form; writes go through the API (which enforces JWT)
ALTER TABLE log_entry_types        ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_entry_fields       ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_entry_field_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read"   ON log_entry_types        FOR SELECT USING (true);
CREATE POLICY "allow_write"   ON log_entry_types        FOR ALL    WITH CHECK (true);

CREATE POLICY "public_read"   ON log_entry_fields       FOR SELECT USING (true);
CREATE POLICY "allow_write"   ON log_entry_fields       FOR ALL    WITH CHECK (true);

CREATE POLICY "public_read"   ON log_entry_field_options FOR SELECT USING (true);
CREATE POLICY "allow_write"   ON log_entry_field_options FOR ALL    WITH CHECK (true);
