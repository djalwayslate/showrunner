alter table org_settings
  add column if not exists website_url text,
  add column if not exists instagram_url text,
  add column if not exists facebook_url text,
  add column if not exists default_venue text,
  add column if not exists default_capacity int default 0,
  add column if not exists default_currency text default 'EUR',
  add column if not exists default_vat_pct numeric default 21;
