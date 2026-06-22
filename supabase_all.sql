-- LK Ops — full schema (idempotent). Safe to run anytime; brings any project up to date.

-- ===== Event richer info =====
alter table events add column if not exists start_time text;
alter table events add column if not exists poster_url text;
alter table events add column if not exists description text;
alter table events add column if not exists ticket_url text;
alter table events add column if not exists drive_url text;
alter table events add column if not exists fb_url text;
alter table events add column if not exists stages jsonb default '["Main Stage"]'::jsonb;

-- ===== Budget line-item breakdown =====
alter table budget_items add column if not exists breakdown jsonb default '[]'::jsonb;

-- ===== Lineup timetable (stage + day) =====
alter table lineup_entries add column if not exists stage text default '';
alter table lineup_entries add column if not exists day_date date;

-- ===== Playbook / Planner / Proposals =====
create table if not exists playbook_entries (
  id uuid default gen_random_uuid() primary key,
  category text not null default 'note' check (category in ('formula','rule','pattern','vendor','note')),
  title text not null, body text default '', sort_order int default 0,
  created_at timestamptz default now()
);
create table if not exists tasks (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade not null,
  title text not null, phase text not null default 'prep' check (phase in ('prep','week','day','post')),
  owner text default '', due_date date,
  status text not null default 'todo' check (status in ('todo','doing','done')),
  sort_order int default 0, created_at timestamptz default now()
);
create table if not exists proposals (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade not null,
  title text not null default 'Untitled proposal', audience text default '', body text default '',
  created_at timestamptz default now()
);
alter table playbook_entries enable row level security;
alter table tasks enable row level security;
alter table proposals enable row level security;

-- ===== Policies (idempotent) =====
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies
           where schemaname='public' and tablename in ('events','playbook_entries','tasks','proposals')
  loop execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename); end loop;
end $$;

create policy "read events" on events for select using (auth.role() = 'authenticated');
create policy "core insert events" on events for insert with check (is_core_plus());
create policy "core update events" on events for update using (is_core_plus()) with check (is_core_plus());
create policy "admin delete events" on events for delete using (is_admin());

create policy "core playbook" on playbook_entries for all using (is_core_plus()) with check (is_core_plus());
create policy "core tasks" on tasks for all using (is_core_plus()) with check (is_core_plus());
create policy "core proposals" on proposals for all using (is_core_plus()) with check (is_core_plus());

-- ===== Seed a starter Playbook (only if empty) =====
insert into playbook_entries (category, title, body, sort_order)
select * from (values
  ('formula','Hospitality multipliers','Drink tickets = 4 per person per day. Food coupons = 1 per person per day. Headliners get a private Room; crew share Doubles.',1),
  ('formula','Break-even','Break-even door count = fixed costs / (avg ticket price - cost per head). Aim to cover costs at 60% of capacity.',2),
  ('rule','Booking standards','Send the contract within 48h of a verbal yes. No artist is confirmed until status = Signed.',3),
  ('pattern','Crowd patterns','Saturday ~1.5x Friday. Core crowd 22-28. Doors 23:00, headliner ~01:30.',4)
) as v(category,title,body,sort_order)
where not exists (select 1 from playbook_entries);
