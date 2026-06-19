-- Run this in your Supabase project → SQL Editor
CREATE TABLE job_events (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  date        DATE NOT NULL,
  title       TEXT NOT NULL,
  client      TEXT,
  location    TEXT,
  description TEXT,
  start_time  TIME,
  end_time    TIME,
  assigned_to TEXT
);

-- Allow anyone to read events (employees viewing schedule)
ALTER TABLE job_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_read" ON job_events FOR SELECT USING (true);
