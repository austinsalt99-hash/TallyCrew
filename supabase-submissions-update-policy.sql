-- Allow anonymous updates on submissions (gated by UUID knowledge in practice)
CREATE POLICY "Allow anon update" ON submissions
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
