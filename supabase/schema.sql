-- Founder Breakfast invite tracker: run this in Supabase → SQL Editor.
-- It is safe to run again; it updates everything in place.

create table if not exists public.invites (
  id              uuid primary key default gen_random_uuid(),
  account_manager text,
  customer        text not null default '',
  contact         text not null default '',
  telephone       text not null default '',
  response        text check (response in ('yes', 'no', 'maybe')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      text
);

-- Record who last changed each invite, and when.
create or replace function public.touch_invite() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.jwt() ->> 'email';
  return new;
end $$;

drop trigger if exists invites_touch on public.invites;
create trigger invites_touch before insert or update on public.invites
  for each row execute function public.touch_invite();

-- Only signed-in @nymbis.cloud and @voxtelecom.co.za users can read or change invites.
create or replace function public.email_allowed() returns boolean language sql stable as $$
  select (auth.jwt() ->> 'email') ilike '%@nymbis.cloud'
      or (auth.jwt() ->> 'email') ilike '%@voxtelecom.co.za';
$$;

alter table public.invites enable row level security;

drop policy if exists "nymbis read"   on public.invites;
drop policy if exists "nymbis insert" on public.invites;
drop policy if exists "nymbis update" on public.invites;
drop policy if exists "nymbis delete" on public.invites;

create policy "nymbis read"   on public.invites for select to authenticated
  using (public.email_allowed());
create policy "nymbis insert" on public.invites for insert to authenticated
  with check (public.email_allowed());
create policy "nymbis update" on public.invites for update to authenticated
  using (public.email_allowed())
  with check (public.email_allowed());
create policy "nymbis delete" on public.invites for delete to authenticated
  using (public.email_allowed());

-- Live updates: everyone sees changes as they happen.
do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'invites') then
    alter publication supabase_realtime add table public.invites;
  end if;
end $$;

-- Team password: everyone signs in with their work email and one shared password.
-- The password is kept here, out of reach of the website. Supabase refuses any account
-- whose password does not match it, so it cannot be bypassed from the browser.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.settings (
  id            int primary key default 1 check (id = 1),
  team_password text not null
);
alter table private.settings enable row level security;

create or replace function public.check_team_account() returns trigger
language plpgsql security definer set search_path = '' as $$
declare pw text;
begin
  if tg_op = 'UPDATE' and new.encrypted_password is not distinct from old.encrypted_password then
    return new;
  end if;
  select team_password into pw from private.settings where id = 1;
  if new.email is null
     or not (new.email ilike '%@nymbis.cloud' or new.email ilike '%@voxtelecom.co.za')
     or pw is null
     or coalesce(new.encrypted_password, '') = ''
     or new.encrypted_password <> extensions.crypt(pw, new.encrypted_password) then
    raise exception 'Wrong email domain or team password';
  end if;
  return new;
end $$;

drop trigger if exists check_team_account on auth.users;
create trigger check_team_account before insert or update on auth.users
  for each row execute function public.check_team_account();

-- Sets (or changes) the team password and applies it to everyone who already has an account.
create or replace function private.set_team_password(pw text) returns void
language plpgsql set search_path = '' as $$
begin
  if length(pw) < 8 then raise exception 'Use at least 8 characters'; end if;
  insert into private.settings (id, team_password) values (1, pw)
    on conflict (id) do update set team_password = excluded.team_password;
  update auth.users
     set encrypted_password = extensions.crypt(pw, extensions.gen_salt('bf'))
   where email ilike '%@nymbis.cloud' or email ilike '%@voxtelecom.co.za';
end $$;
revoke all on function private.set_team_password(text) from public, anon, authenticated;

-- Choose your team password: replace the text below, then run this line on its own.
-- Run it again any time you want to change the password.
-- select private.set_team_password('Choose-A-Team-Password');
