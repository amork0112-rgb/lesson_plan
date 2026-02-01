-- Add sessions column to academic_calendar table
ALTER TABLE academic_calendar 
ADD COLUMN sessions INTEGER DEFAULT 0;

-- Optional: Add sessions column to special_dates table if used for class-specific overrides
ALTER TABLE special_dates 
ADD COLUMN sessions INTEGER DEFAULT 0;
