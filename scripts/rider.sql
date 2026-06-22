alter table lineup_entries add column if not exists rider jsonb default '[]'::jsonb;
