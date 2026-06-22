create table if not exists org_settings (
  id int primary key default 1,
  brand_name text default 'Latino Kings',
  tagline text default 'Baile funk / Latin electronic · Vilnius',
  default_stages jsonb default '["Main Stage"]'::jsonb,
  default_drinks int default 4,
  default_food int default 1,
  ticket_types jsonb default '["Free","Paper","Box","Paid","VIP"]'::jsonb,
  updated_at timestamptz default now(),
  constraint org_singleton check (id = 1)
);
insert into org_settings (id) values (1) on conflict do nothing;
alter table org_settings enable row level security;
drop policy if exists "read org_settings" on org_settings;
drop policy if exists "admin org_settings" on org_settings;
create policy "read org_settings" on org_settings for select using (auth.role() = 'authenticated');
create policy "admin org_settings" on org_settings for update using (is_admin()) with check (is_admin());
