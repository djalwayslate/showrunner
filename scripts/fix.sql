-- LK Ops — definitive RLS + schema reset. Idempotent.

-- helper functions (recreate to be safe)
create or replace function is_core_plus() returns boolean language sql security definer as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('admin','core')) $$;
create or replace function is_admin() returns boolean language sql security definer as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;

-- ensure RLS on
alter table profiles enable row level security;
alter table events enable row level security;
alter table hosp_settings enable row level security;
alter table hosp_people enable row level security;
alter table hosp_person_days enable row level security;
alter table lineup_entries enable row level security;
alter table budget_items enable row level security;
alter table playbook_entries enable row level security;
alter table tasks enable row level security;
alter table proposals enable row level security;

-- drop ALL existing policies on these tables
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname='public'
    and tablename in ('profiles','events','hosp_settings','hosp_people','hosp_person_days','lineup_entries','budget_items','playbook_entries','tasks','proposals')
  loop execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename); end loop;
end $$;

-- profiles
create policy "own profile" on profiles for all using (auth.uid() = id) with check (auth.uid() = id);

-- events
create policy "read events" on events for select using (auth.role() = 'authenticated');
create policy "core insert events" on events for insert with check (is_core_plus());
create policy "core update events" on events for update using (is_core_plus()) with check (is_core_plus());
create policy "admin delete events" on events for delete using (is_admin());

-- hospitality (core+ full)
create policy "core hosp_settings" on hosp_settings for all using (is_core_plus()) with check (is_core_plus());
create policy "core hosp_people" on hosp_people for all using (is_core_plus()) with check (is_core_plus());
create policy "core hosp_days" on hosp_person_days for all using (is_core_plus()) with check (is_core_plus());

-- lineup (core+ full)
create policy "core lineup" on lineup_entries for all using (is_core_plus()) with check (is_core_plus());

-- budget (core+ read, admin write)
create policy "core read budget" on budget_items for select using (is_core_plus());
create policy "admin insert budget" on budget_items for insert with check (is_admin());
create policy "admin update budget" on budget_items for update using (is_admin()) with check (is_admin());
create policy "admin delete budget" on budget_items for delete using (is_admin());

-- playbook / tasks / proposals (core+ full)
create policy "core playbook" on playbook_entries for all using (is_core_plus()) with check (is_core_plus());
create policy "core tasks" on tasks for all using (is_core_plus()) with check (is_core_plus());
create policy "core proposals" on proposals for all using (is_core_plus()) with check (is_core_plus());

-- seed playbook if empty
insert into playbook_entries (category, title, body, sort_order)
select * from (values
  ('formula','Hospitality multipliers','Drink tickets = 4 per person per day. Food coupons = 1 per person per day. Headliners get a private Room; crew share Doubles.',1),
  ('formula','Break-even','Break-even door count = fixed costs / (avg ticket price - cost per head). Aim to cover costs at 60% of capacity.',2),
  ('rule','Booking standards','Send the contract within 48h of a verbal yes. No artist is confirmed until status = Signed.',3),
  ('pattern','Crowd patterns','Saturday ~1.5x Friday. Core crowd 22-28. Doors 23:00, headliner ~01:30.',4)
) as v(category,title,body,sort_order)
where not exists (select 1 from playbook_entries);
