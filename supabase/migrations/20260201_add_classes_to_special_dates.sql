
-- Add classes column to special_dates table if it doesn't exist
-- We use TEXT[] because Supabase/Postgres arrays are versatile, and IDs are usually UUIDs stored as text or UUID type.
-- Since the user input mentioned "uuid[]", we can try UUID[] but TEXT[] is safer if there's any inconsistency.
-- However, given the project uses UUIDs for IDs, let's stick to TEXT[] for maximum compatibility with the frontend string IDs, 
-- or UUID[] if we are sure. The user comment says "classes // uuid[]".
-- Let's use UUID[] but cast to text if needed, or just TEXT[] to be safe against "c_r1" style IDs if they exist.
-- Checking existing IDs in data.ts: "c_f1a", "c_r3". These are NOT UUIDs. They are string IDs.
-- So I MUST use TEXT[].

ALTER TABLE special_dates 
ADD COLUMN IF NOT EXISTS classes TEXT[] DEFAULT NULL;
