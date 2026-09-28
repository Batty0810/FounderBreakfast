-- Founder Breakfast invite tracker: run this once in Supabase → SQL Editor.

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
alter publication supabase_realtime add table public.invites;
