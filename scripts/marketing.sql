create table if not exists marketing_spend (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade not null,
  channel text not null default 'Instagram',
  amount numeric(10,2) default 0,
  reach int default 0,
  conversions int default 0,
  notes text default '',
  sort_order int default 0,
  created_at timestamptz default now()
);
alter table marketing_spend enable row level security;
drop policy if exists "core marketing" on marketing_spend;
create policy "core marketing" on marketing_spend for all using (is_core_plus()) with check (is_core_plus());
