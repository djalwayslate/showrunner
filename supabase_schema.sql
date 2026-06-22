-- Run this entire file in the Supabase SQL editor (one paste, one run).
-- Dashboard > SQL Editor > New query > paste > Run

-- Profiles (1:1 with auth.users)
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text,
  role text not null default 'core' check (role in ('admin', 'core', 'sponsor', 'artist')),
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'core'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Events
create table if not exists events (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  venue text,
  start_date date not null,
  end_date date not null,
  created_at timestamptz default now()
);

insert into events (name, venue, start_date, end_date)
values ('Raze Carnaval 2026', 'Raze', '2026-07-13', '2026-07-19')
on conflict do nothing;

-- Hosp settings
create table if not exists hosp_settings (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade not null,
  drinks_per_person int not null default 4,
  food_per_person int not null default 1,
  updated_at timestamptz default now()
);

insert into hosp_settings (event_id, drinks_per_person, food_per_person)
select id, 4, 1 from events where name = 'Raze Carnaval 2026'
on conflict do nothing;

-- Hosp people
create table if not exists hosp_people (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade not null,
  name text not null,
  count int not null default 1,
  room text not null default 'Single' check (room in ('Single', 'Double', 'Room')),
  role text not null default '' check (role in ('', 'Org', 'Crew', 'Headliner')),
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Hosp person days (join table)
create table if not exists hosp_person_days (
  id uuid default gen_random_uuid() primary key,
  person_id uuid references hosp_people(id) on delete cascade not null,
  day int not null check (day between 13 and 19),
  unique(person_id, day)
);

-- Lineup entries
create table if not exists lineup_entries (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade not null,
  name text not null,
  role text not null default 'Support' check (role in ('Headliner', 'Support', 'Crew', 'Org')),
  start_time text,
  end_time text,
  fee numeric(10,2) default 0,
  status text not null default 'Pending' check (status in ('Pending', 'Sent', 'Signed', 'Paid')),
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Budget items
create table if not exists budget_items (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade not null,
  type text not null check (type in ('revenue', 'cost')),
  label text not null,
  planned numeric(12,2) default 0,
  actual numeric(12,2) default 0,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Seed budget default lines
insert into budget_items (event_id, type, label, planned, actual, sort_order)
select e.id, v.type, v.label, 0, 0, v.ord
from events e
cross join (values
  ('revenue', 'Door', 1),
  ('revenue', 'Sponsorship', 2),
  ('revenue', 'Merch', 3),
  ('revenue', 'Bar split', 4),
  ('cost', 'Artist fees', 1),
  ('cost', 'Venue rent', 2),
  ('cost', 'Hospitality', 3),
  ('cost', 'Production', 4),
  ('cost', 'Marketing', 5)
) as v(type, label, ord)
where e.name = 'Raze Carnaval 2026'
on conflict do nothing;

-- ===================== RLS =====================

alter table profiles enable row level security;
alter table events enable row level security;
alter table hosp_settings enable row level security;
alter table hosp_people enable row level security;
alter table hosp_person_days enable row level security;
alter table lineup_entries enable row level security;
alter table budget_items enable row level security;

-- Drop old policies if re-running
do $$ declare
  r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
           where schemaname = 'public' and tablename in
             ('profiles','events','hosp_settings','hosp_people','hosp_person_days','lineup_entries','budget_items')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Profiles
create policy "own profile" on profiles for all using (auth.uid() = id);

-- Events: all authenticated can read
create policy "read events" on events for select using (auth.role() = 'authenticated');

-- Helper: is current user core or admin?
create or replace function is_core_plus() returns boolean language sql security definer as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'core'))
$$;

create or replace function is_admin() returns boolean language sql security definer as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

-- Hosp
create policy "core+ hosp_settings" on hosp_settings for all using (is_core_plus());
create policy "core+ hosp_people" on hosp_people for all using (is_core_plus());
create policy "core+ hosp_days" on hosp_person_days for all using (is_core_plus());

-- Lineup
create policy "core+ lineup" on lineup_entries for all using (is_core_plus());

-- Budget: admin write, core/admin read
create policy "core+ read budget" on budget_items for select using (is_core_plus());
create policy "admin write budget" on budget_items for insert with check (is_admin());
create policy "admin update budget" on budget_items for update using (is_admin());
create policy "admin delete budget" on budget_items for delete using (is_admin());
