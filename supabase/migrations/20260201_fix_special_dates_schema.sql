
-- Ensure special_dates table exists with correct structure
CREATE TABLE IF NOT EXISTS special_dates (
  date TEXT PRIMARY KEY, -- Using TEXT for YYYY-MM-DD to be simple and consistent with frontend
  type TEXT NOT NULL,
  name TEXT,
  sessions INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure RLS is enabled
ALTER TABLE special_dates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for all users" ON special_dates FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON special_dates FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON special_dates FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON special_dates FOR DELETE USING (true);

-- If table already existed but date wasn't unique or PK, this might fail or need adjustment.
-- But since we use upsert on 'date', it should be a unique constraint or PK.
-- The above CREATE TABLE sets it as PK.

-- If the table exists, we might want to ensure 'sessions' column exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'special_dates' AND column_name = 'sessions') THEN
        ALTER TABLE special_dates ADD COLUMN sessions INTEGER DEFAULT 0;
    END IF;
END $$;
