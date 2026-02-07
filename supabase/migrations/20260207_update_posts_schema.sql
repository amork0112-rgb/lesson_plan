-- Add new columns to posts table to support lesson plan notices
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS category text,
ADD COLUMN IF NOT EXISTS scope text,
ADD COLUMN IF NOT EXISTS published boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS attachment_url text,
ADD COLUMN IF NOT EXISTS attachment_type text,
ADD COLUMN IF NOT EXISTS class_id uuid, -- Assuming class_id is uuid
ADD COLUMN IF NOT EXISTS creator_id uuid;

-- Optional: Add index for performance
CREATE INDEX IF NOT EXISTS idx_posts_class_id ON posts(class_id);
