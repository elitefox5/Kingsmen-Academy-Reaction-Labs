-- Kingsmen Academy Reaction Labs — Supabase schema.
--
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to re-run (every statement is guarded), so don't worry about running it twice.
--
-- ALREADY RUN THIS ONCE BEFORE 2026-08-04? `create table if not exists` won't retroactively
-- fix an existing table's foreign keys, so run this once first (safe — records/runs are
-- still empty at this point, nothing to lose):
--
--   alter table public.records drop constraint if exists records_user_id_fkey;
--   alter table public.records add constraint records_user_id_fkey
--     foreign key (user_id) references public.profiles(id) on delete cascade;
--   alter table public.runs drop constraint if exists runs_user_id_fkey;
--   alter table public.runs add constraint runs_user_id_fkey
--     foreign key (user_id) references public.profiles(id) on delete cascade;
--
-- Then run the rest of this file as normal — the policy sections below also replace the
-- old "viewable by everyone" (anonymous-readable) policies with signed-in-only ones, add
-- player-chosen usernames (a unique constraint, an updated sign-up trigger, and a new
-- username_available() check), and add sign-in-by-username support (email_for_username()),
-- so re-running the whole file takes care of all of that too. No separate step needed.
--
-- Design note: `records` mirrors the app's local `ka_record_<key>` keyspace exactly —
-- same flat key/value shape, one row per (user, key). The rank tiers themselves are never
-- stored; they're computed client-side from these raw numbers every time a badge renders
-- (see js/core/shared.js), so recalibrating the rank ladders later needs no migration here.

-- ---------------------------------------------------------------------------------------
-- profiles — one row per signed-up user. username is player-chosen at sign-up (passed
-- through as auth metadata — see js/core/cloud.js) and is what the leaderboard displays.
-- Falls back to the email's local part only if it somehow arrives without one.
-- ---------------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now()
);

-- Two players can't hold the same displayed name — the leaderboard couldn't tell them
-- apart. Drop-then-add keeps this safe to re-run.
alter table public.profiles drop constraint if exists profiles_username_key;
alter table public.profiles add constraint profiles_username_key unique (username);

alter table public.profiles enable row level security;

-- Readable only by signed-in players, not the wider internet. The anon key embedded in
-- the app is meant to be public, so "using (true)" here would let anyone holding it query
-- every player's data without ever creating an account — fine for a public leaderboard
-- later, not for now. auth.role() = 'authenticated' is what actually enforces that: it's
-- true only when the request carries a valid session, regardless of what the anon key is.
drop policy if exists "profiles are viewable by everyone" on public.profiles;
drop policy if exists "profiles are viewable by signed-in users" on public.profiles;
create policy "profiles are viewable by signed-in users"
  on public.profiles for select
  using (auth.role() = 'authenticated');

drop policy if exists "users can insert own profile" on public.profiles;
create policy "users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-creates a profile row the moment someone signs up, so the app never has to.
-- The username comes from auth metadata (signUp's `options.data.username`) — the app
-- already checked it was free via username_available() before ever submitting the form,
-- so this should never collide in normal use; the unique constraint is the hard backstop
-- for the rare race (two people claiming the same name in the same instant).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Lets an anonymous visitor (mid sign-up, not authenticated yet) check whether a username
-- is free without exposing anything else — the profiles SELECT policy above deliberately
-- requires being signed in, so this is the one narrow, safe exception carved out for it.
-- Also used when an already-signed-in player renames themselves — `id is distinct from
-- auth.uid()` excludes their own current row so their unchanged name doesn't read as taken
-- (auth.uid() is null for the anonymous sign-up case, where this exclusion is simply a
-- no-op — nobody is signed in yet to exclude).
create or replace function public.username_available(check_username text)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select not exists (
    select 1 from public.profiles
    where username = check_username
      and id is distinct from auth.uid()
  );
$$;

grant execute on function public.username_available(text) to anon, authenticated;

-- Lets someone sign in with their username instead of their email: the app looks up the
-- matching email here first, then calls the normal password sign-in with it. This is the
-- one deliberate, narrow privacy tradeoff in this schema — anyone can pair a public
-- username (already visible on the leaderboard) with the account's email address this way.
-- Acceptable for a small trusted group; worth reconsidering before this ever goes public.
create or replace function public.email_for_username(check_username text)
returns text
language sql
security definer set search_path = public
stable
as $$
  select au.email::text
  from auth.users au
  join public.profiles p on p.id = au.id
  where p.username = check_username
  limit 1;
$$;

grant execute on function public.email_for_username(text) to anon, authenticated;

-- ---------------------------------------------------------------------------------------
-- records — the cloud mirror of KA_records. One row per (user, key); upserted on every
-- new personal best. Readable by any signed-in player (that's what powers the global
-- leaderboard) but not by an anonymous visitor, writable only by the row's own owner.
--
-- higher_is_better matters because "best" means different things per key: more correct
-- answers is better, but a lower average reaction time is better. The app tells this
-- table which direction applies at write time — see js/core/cloud.js.
-- ---------------------------------------------------------------------------------------
-- user_id references profiles, not auth.users, on purpose: PostgREST can only auto-embed
-- a joined table (profiles(username), in fetchLeaderboard) when there's a direct foreign
-- key to it. A shared FK to auth.users from both tables is not a path it can walk.
create table if not exists public.records (
  user_id uuid not null references public.profiles(id) on delete cascade,
  key text not null,
  value numeric not null,
  higher_is_better boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.records enable row level security;

drop policy if exists "records are viewable by everyone" on public.records;
drop policy if exists "records are viewable by signed-in users" on public.records;
create policy "records are viewable by signed-in users"
  on public.records for select
  using (auth.role() = 'authenticated');

drop policy if exists "users can insert own records" on public.records;
create policy "users can insert own records"
  on public.records for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can update own records" on public.records;
create policy "users can update own records"
  on public.records for update
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------------------
-- runs — a private per-user activity log, mirroring the local KA_history feed. Not shown
-- to other users; it's a personal history, not leaderboard material.
-- ---------------------------------------------------------------------------------------
create table if not exists public.runs (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_name text not null,
  summary text not null,
  occurred_at timestamptz not null default now()
);

alter table public.runs enable row level security;

drop policy if exists "users can view own runs" on public.runs;
create policy "users can view own runs"
  on public.runs for select
  using (auth.uid() = user_id);

drop policy if exists "users can insert own runs" on public.runs;
create policy "users can insert own runs"
  on public.runs for insert
  with check (auth.uid() = user_id);

create index if not exists runs_user_id_occurred_at_idx
  on public.runs (user_id, occurred_at desc);

create index if not exists records_key_idx
  on public.records (key);
