create table if not exists posts (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text,
  class_ids text[] default '{}',
  author_id uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table posts enable row level security;

-- Policies
create policy "Public read access"
  on posts for select
  using ( true );

create policy "Authenticated insert access"
  on posts for insert
  with check ( auth.role() = 'authenticated' or true ); -- relaxed for dev
