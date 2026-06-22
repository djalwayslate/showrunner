create table if not exists inventory_items (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade not null,
  item text not null default '', qty text default '', source text default '',
  got boolean default false, notes text default '', sort_order int default 0,
  created_at timestamptz default now()
);
create table if not exists crew_contacts (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade not null,
  name text not null default '', role text default '', phone text default '', email text default '',
  notes text default '', sort_order int default 0,
  created_at timestamptz default now()
);
alter table inventory_items enable row level security;
alter table crew_contacts enable row level security;
drop policy if exists "core inventory" on inventory_items;
drop policy if exists "core crew" on crew_contacts;
create policy "core inventory" on inventory_items for all using (is_core_plus()) with check (is_core_plus());
create policy "core crew" on crew_contacts for all using (is_core_plus()) with check (is_core_plus());
