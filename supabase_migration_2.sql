-- LK Ops — migration 2: Playbook, Planner, Proposals
-- Paste the whole thing into Supabase SQL Editor and Run once.

-- Playbook (global org knowledge — formulas, rules, patterns, vendors)
create table if not exists playbook_entries (
  id uuid default gen_random_uuid() primary key,
  category text not null default 'note' check (category in ('formula','rule','pattern','vendor','note')),
  title text not null,
  body text default '',
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Planner tasks (per event)
create table if not exists tasks (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade not null,
  title text not null,
  phase text not null default 'prep' check (phase in ('prep','week','day','post')),
  owner text default '',
  due_date date,
  status text not null default 'todo' check (status in ('todo','doing','done')),
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Proposals (per event, AI-generated, editable)
create table if not exists proposals (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade not null,
  title text not null default 'Untitled proposal',
  audience text default '',
  body text default '',
  created_at timestamptz default now()
);

alter table playbook_entries enable row level security;
alter table tasks enable row level security;
alter table proposals enable row level security;

do $$ declare r record;
begin
  for r in select policyname, tablename from pg_policies
           where schemaname='public' and tablename in ('playbook_entries','tasks','proposals')
  loop execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename); end loop;
end $$;

create policy "core playbook" on playbook_entries for all using (is_core_plus()) with check (is_core_plus());
create policy "core tasks" on tasks for all using (is_core_plus()) with check (is_core_plus());
create policy "core proposals" on proposals for all using (is_core_plus()) with check (is_core_plus());

-- Seed a few starter playbook entries so it isn't empty
insert into playbook_entries (category, title, body, sort_order) values
('formula', 'Hospitality multipliers', 'Drink tickets = 4 per person per day. Food coupons = 1 per person per day. Headliners always get a private Room; crew share Doubles.', 1),
('formula', 'Break-even', 'Break-even door count = total fixed costs ÷ (avg ticket price − variable cost per head). Aim to cover costs at 60% of venue capacity.', 2),
('rule', 'Booking standards', 'Always send the contract within 48h of a verbal yes. No artist is "confirmed" in Lineup until status = Signed.', 3),
('pattern', 'Crowd patterns', 'Saturday typically draws ~1.5x Friday. Core crowd skews 22–28. Doors at 23:00, headliner ~01:30.', 4)
on conflict do nothing;
