create table if not exists shared_plans (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  class_id text, -- using text to be flexible if class_id is sometimes a string representation
  class_name text,
  plan_image_url text not null
);

alter table shared_plans enable row level security;

create policy "Enable read access for all users" on shared_plans for select using (true);
create policy "Enable insert for all users" on shared_plans for insert with check (true);

-- Create storage bucket 'plans' if it doesn't exist
insert into storage.buckets (id, name, public)
values ('plans', 'plans', true)
on conflict (id) do nothing;

-- Storage policies
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'plans' );

create policy "Authenticated Insert"
  on storage.objects for insert
  with check ( bucket_id = 'plans' );
