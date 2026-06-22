-- email on profiles so the admin panel can show who's who
alter table profiles add column if not exists email text;
update profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;

-- capture email on new signups
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, role, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@','1')::text), 'core', new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end; $$;

-- admins can read & manage every profile; everyone can read/update their own
drop policy if exists "own profile" on profiles;
drop policy if exists "read profiles" on profiles;
drop policy if exists "update own or admin" on profiles;
drop policy if exists "insert own profile" on profiles;
create policy "read profiles" on profiles for select using (auth.uid() = id or is_admin());
create policy "update own or admin" on profiles for update using (auth.uid() = id or is_admin()) with check (auth.uid() = id or is_admin());
create policy "insert own profile" on profiles for insert with check (auth.uid() = id);
