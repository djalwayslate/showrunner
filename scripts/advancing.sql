-- LK Ops — Advancing portal tables. Idempotent.
-- External parties (artists, promoter, drivers, hotel, sound tech) fill in their
-- own sections via a tokenized public link. These tables are TEAM-ONLY at the RLS
-- level; anonymous external access happens exclusively through the service-role
-- server routes in /api/advance/*, which validate the recipient token first.

create table if not exists advance_recipients (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  lineup_entry_id uuid references lineup_entries(id) on delete cascade,
  name text not null default '',
  email text,
  token text not null unique,
  scope text not null default 'artist',         -- 'artist' | 'event'
  invited_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists advance_recipients_event_idx on advance_recipients(event_id);
create index if not exists advance_recipients_token_idx on advance_recipients(token);

create table if not exists advance_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  recipient_id uuid references advance_recipients(id) on delete cascade,
  lineup_entry_id uuid references lineup_entries(id) on delete cascade,
  category text not null,                        -- key into the field schema map
  title text not null default '',
  data jsonb not null default '{}'::jsonb,       -- field values for this category
  status text not null default 'open',           -- 'open' | 'submitted' | 'approved'
  sort_order int not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists advance_requests_event_idx on advance_requests(event_id);
create index if not exists advance_requests_recipient_idx on advance_requests(recipient_id);

create table if not exists advance_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references advance_requests(id) on delete cascade,
  author_name text not null default '',
  author_type text not null default 'external',  -- 'team' | 'external'
  body text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists advance_messages_request_idx on advance_messages(request_id);

create table if not exists advance_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references advance_requests(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  content_type text,
  size bigint,
  uploaded_by text not null default 'external',  -- 'team' | 'external'
  created_at timestamptz not null default now()
);
create index if not exists advance_attachments_request_idx on advance_attachments(request_id);

-- RLS: team-only (is_core_plus). External access is via service-role routes only.
alter table advance_recipients enable row level security;
alter table advance_requests enable row level security;
alter table advance_messages enable row level security;
alter table advance_attachments enable row level security;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname='public'
    and tablename in ('advance_recipients','advance_requests','advance_messages','advance_attachments')
  loop execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename); end loop;
end $$;

create policy "core advance_recipients" on advance_recipients for all using (is_core_plus()) with check (is_core_plus());
create policy "core advance_requests"   on advance_requests   for all using (is_core_plus()) with check (is_core_plus());
create policy "core advance_messages"   on advance_messages   for all using (is_core_plus()) with check (is_core_plus());
create policy "core advance_attachments" on advance_attachments for all using (is_core_plus()) with check (is_core_plus());
