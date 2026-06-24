create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position text,
  email text,
  phone text,
  instagram text,
  avatar_color text default '#C5613D',
  sort_order int default 0,
  created_at timestamptz default now()
);

alter table team_members enable row level security;

create policy "team_members_read" on team_members
  for select using (auth.role() = 'authenticated');

create policy "team_members_write" on team_members
  for all using (is_core_plus());
