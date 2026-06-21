-- Fix: FOR ALL WITH CHECK (true) doesn't cover UPDATE row filtering without explicit USING.
-- Replace the write policies with ones that include both USING and WITH CHECK.

DROP POLICY IF EXISTS "allow_write" ON log_entry_types;
CREATE POLICY "allow_write" ON log_entry_types FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_write" ON log_entry_fields;
CREATE POLICY "allow_write" ON log_entry_fields FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_write" ON log_entry_field_options;
CREATE POLICY "allow_write" ON log_entry_field_options FOR ALL USING (true) WITH CHECK (true);
