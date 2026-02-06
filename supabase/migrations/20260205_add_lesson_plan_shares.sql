create table if not exists lesson_plan_shares (
  id uuid default gen_random_uuid() primary key,
  class_id text not null,
  campus text,
  class_name text,
  year integer,
  month integer,
  pdf_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

insert into storage.buckets (id, name, public)
values ('lesson-plans', 'lesson-plans', true)
on conflict (id) do nothing;

create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'lesson-plans' );

create policy "Auth Upload"
  on storage.objects for insert
  with check ( bucket_id = 'lesson-plans' );
