create table if not exists private_lesson_books (
  id uuid default gen_random_uuid() primary key,
  private_lesson_id uuid not null references private_lessons(id) on delete cascade,
  book_id text not null, -- using text to support both uuid and legacy string ids
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_private_lesson_books_lesson on private_lesson_books(private_lesson_id);

-- Migrate existing single book_id to the new table
-- We use distinct to avoid duplicates if run multiple times, though logic prevents it mostly
insert into private_lesson_books (private_lesson_id, book_id)
select id, book_id::text
from private_lessons
where book_id is not null
  and not exists (
    select 1 from private_lesson_books plb 
    where plb.private_lesson_id = private_lessons.id 
    and plb.book_id = private_lessons.book_id::text
  );
