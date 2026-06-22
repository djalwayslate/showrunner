alter table events add column if not exists excluded_days jsonb default '[]'::jsonb;
