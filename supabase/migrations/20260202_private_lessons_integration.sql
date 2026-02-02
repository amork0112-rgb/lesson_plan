-- 1. Create private_lessons table
create table if not exists private_lessons (
  id uuid default gen_random_uuid() primary key,
  student_name text not null,
  instrument text,
  status text check (status in ('active', 'paused', 'completed')) default 'active',
  start_date date,
  schedule jsonb, -- e.g. {"Mon": "14:00", "Thu": "16:00"}
  book_id uuid,
  memo text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Modify lesson_plans table
-- Add owner columns
alter table lesson_plans 
add column if not exists owner_type text check (owner_type in ('class', 'private')) default 'class',
add column if not exists owner_id uuid;

-- Migrate existing data: set owner_type='class' and owner_id=class_id for existing rows
update lesson_plans 
set owner_type = 'class', 
    owner_id = class_id 
where owner_id is null;

-- Make class_id optional (nullable)
alter table lesson_plans alter column class_id drop not null;

-- Add index for performance
create index if not exists idx_lesson_plans_owner on lesson_plans(owner_type, owner_id);
