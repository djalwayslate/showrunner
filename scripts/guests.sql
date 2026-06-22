create table if not exists guests (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade not null,
  name text not null default '',
  added_by text default '',
  status text not null default 'Accepted' check (status in ('Pending','Accepted','Declined')),
  ticket_type text default 'Paper',
  plus_ones int default 0,
  attended boolean default false,
  notes text default '',
  sort_order int default 0,
  created_at timestamptz default now()
);
alter table guests enable row level security;
drop policy if exists "core guests" on guests;
create policy "core guests" on guests for all using (is_core_plus()) with check (is_core_plus());
